import { BoopProcess, shellExecuteAsync } from "./shell.js";
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import EventEmitter from "events";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "../../constants.js";
import { isNodeAbortException } from "../utilities.js";
import logger, { type EventLog, makeLogDirName, type ProcessLog } from "../../logger.js";
import AsyncLock from "async-lock";

const LOCK_RUN_KEY = "run";
const STEP_EVENT = "step";
const STEP_EXIT_EVENT = "stepExit";
const EXIT_EVENT = "exit";

interface InstallRunnerEvents {
    'start': (eventReference: string | null) => void;
    'exit': (error?: Error) => void;
    'step': (step: InstallerStep) => void;
    'stepExit': (step: InstallerStep) => void;
}

export interface InstallerStep {
    cmd: string,
    process: BoopProcess | null,
    success: boolean
}

export interface InstallerLog extends EventLog {
    steps: ProcessLog[]
}

export interface InstallRunner {
    on<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    once<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    emit<EventType extends keyof InstallRunnerEvents>(event: EventType, ...args: Parameters<InstallRunnerEvents[EventType]>): boolean;
    removeListener<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    removeAllListeners<EventType extends keyof InstallRunnerEvents>(event?: EventType): this;
}

export class InstallRunner extends EventEmitter {
    private _lock: AsyncLock = new AsyncLock();
    private projectBinDir: string;
    private _currentStep: InstallerStep | null = null;
    private _endTime: number = 0;
    private _startTime: number = 0;
    private _eventReference: string | null = null;

    public steps: InstallerStep[] = [];

    /**
     * The current active step of the install process. `null` if the runner is stopped.
     */
    public get currentStep() {
        return this._currentStep;
    }

    /**
     * Whether the installer is currently running.
     */
    public get running(): boolean {
        return this._lock.isBusy(LOCK_RUN_KEY);
    }

    /**
     * Gets if the installer completed successfully. `false` if not all steps exited cleanly.
     */
    public get success(): boolean {
        return this.steps.map(el => (el.process != null && el.process.exitCode == 0)).every(el => el == true);
    }

    /**
     * Returns the webhook event ID that triggered the runner, if set. 
     * 
     * Will be `null` if not given during {@link run|run()}.
     */
    public get eventTrigger(): string | null {
        return this._eventReference;
    }

    /**
     * Returns the timestamp when the runner started.
     */
    public get startedAt(): number {
        return this._startTime;
    }

    /**
     * Returns the timestamp when the runner's last active process exited.
     */
    public get exitedAt(): number {
        return this._endTime;
    }

    constructor(cwd: string) {
        super();
        this.projectBinDir = cwd;
    }

    /**
     * Loads the currently present build configuration from the project directory.
     */
    public async loadConfiguration(): Promise<void> {
        this.throwIfRunning();
        const buildFile = await getWorkflowFile(this.projectBinDir);
        const buildConfig = await parseWorkflow(buildFile);
        this.steps = buildConfig.build.map(el => ({
            cmd: el,
            process: null,
            success: false
        }));
    }

    /**
     * Starts the install runner with the loaded build config file. 
     * The promise will resolve when all steps have successfully completed, or reject if one of them fails.
     * 
     * Use {@link loadConfiguration} to load the latest build file.
     * @returns 
     */
    public async run(eventReference?: string, cancel?: AbortSignal): Promise<void> {
        this.throwIfRunning();
        await this._lock.acquire(LOCK_RUN_KEY, async () => {
            cancel?.throwIfAborted();
            this._startTime = Date.now();
            this._eventReference = eventReference ?? null;
            const cancelHandler = () => {
                this.kill(true);
            };
            cancel?.addEventListener("abort", cancelHandler);
            //
            this.emit("start", eventReference ?? null);
            //
            const logDir = join(this.projectBinDir, "..", PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, makeLogDirName(this._startTime, eventReference));
            try {
                await mkdir(logDir);
            }
            catch (err) {
                throw new Error("Installer log directory could not be created", {cause: err});
            }
            let stepIdx = 0;
            for (; stepIdx < this.steps.length; stepIdx++) {
                const step = this.steps[stepIdx];
                try {
                    cancel?.throwIfAborted();
                    await using proc = shellExecuteAsync(step.cmd, this.projectBinDir);
                    step.process = proc;
                    this._currentStep = step;
                    const filePath = join(logDir, `${stepIdx}.log`);
                    proc.redirectToFile(filePath);
                    this.emit(STEP_EVENT, this._currentStep);
                    await proc.waitForExit();
                    step.success = true;
                }
                catch (err) {
                    // Consume errors on purpose. run() is like a container method so we only really care about the whole process,
                    // not individual steps. Any specific error is up to the user to handle and sort out, so they'll be packaged
                    // into the error in the end.
                    if (isNodeAbortException(err instanceof SuppressedError ? err.suppressed : err)) {
                        logger.warn(`Installer failed because step process was disposed of independently.`, { step: stepIdx, cmd: this.steps[stepIdx].cmd, projectContext: this.projectBinDir });
                    }
                }
                finally {
                    this.emit(STEP_EXIT_EVENT, step);
                    if (step.process == null || step.process?.exitCode != 0) {
                        break;
                    }
                }   
            }
            cancel?.removeEventListener("abort", cancelHandler);
            this._endTime = Date.now();
            this._currentStep = null;
            //
            try {
                await this.saveLog(logDir, this._startTime, eventReference);
            }
            catch (err) {
                logger.logException(new Error("Installer log could not be saved", { cause: err }));
            }
            // Throw a wrapped error if the installer didn't complete with success.
            // This will be a lot more useful than throwing whatever happens on its own.
            if (this.success == false) {
                const cause = {
                    project: this.projectBinDir,
                    step: stepIdx,
                    cmd: this.steps[stepIdx].cmd,
                    exitCode: this.steps[stepIdx].process?.exitCode ?? null
                }
                const err = new Error("Installer failed to complete.", { cause: cause });
                this.emit(EXIT_EVENT, err);
                throw err;
            }
            else {
                this.emit(EXIT_EVENT);
            }
        });
    }

    /**
     * Stops all steps' and their child processes.
     */
    public async kill(force?: boolean): Promise<void> {
        if (this.running == false) {
            return;
        }
        const errors: any[] = [];
        for (const step of this.steps) {
            try {
                await step.process?.kill(true, force);
            }
            catch (err){
                errors.push(err);
            }
        }
        if (errors.length != 0) {
            throw new AggregateError(errors, `One or more installer steps failed to stop.`);
        }
    }

    private throwIfRunning() {
        if (this._lock.isBusy(LOCK_RUN_KEY)) {
            throw new Error("Installer run is in progress; busy.");
        }
    }

    private async saveLog(dir: string, time: number, ref?: string) {
        const log: InstallerLog = {
            time: time,
            ref: ref,
            steps: this.steps.map((el, idx) => ({
                cmd: el.cmd,
                log: `${idx}.log`,
                exitCode: el.process?.exitCode ?? null,
                startTime: el.process?.startTime ?? -1,
                exitTime: el.process?.exitTime ?? -1,
                killed: el.process?.wasKilled ?? false
            }))
        };
        const file = join(dir, `result.json`);
        await writeFile(file, JSON.stringify(log));       
    }
}

