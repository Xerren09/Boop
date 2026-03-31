import { BoopProcess, shellExecuteAsync } from "./shell.js";
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import EventEmitter from "events";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "../../constants.js";
import { getAllProjectOutputFiles, isNodeAbortException, makeProjectOutputFileName, searchProjectOutputFile } from "../utilities.js";
import logger from "../../logger.js";

const STEP_EVENT = "step";
const STEP_EXIT_EVENT = "stepExit";
const EXIT_EVENT = "exit";

interface InstallRunnerEvents {
    'start': (eventReference?: string) => void;
    'exit': (success: boolean) => void;
    'step': (step: InstallerStep) => void;
    'stepExit': (step: InstallerStep) => void;
}

export interface InstallerStep {
    cmd: string,
    process: null | BoopProcess
}

export interface InstallerLog {
    time: number,
    ref?: string | null,
    steps: {
        cmd: string,
        log: string,
        exitCode: number | null,
        start: number,
        end: number
    }[]
}

export interface InstallRunner {
    on<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    once<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    emit<EventType extends keyof InstallRunnerEvents>(event: EventType, ...args: Parameters<InstallRunnerEvents[EventType]>): boolean;
    removeListener<EventType extends keyof InstallRunnerEvents>(event: EventType, listener: InstallRunnerEvents[EventType]): this;
    removeAllListeners<EventType extends keyof InstallRunnerEvents>(event?: EventType): this;
}

export class InstallRunner extends EventEmitter {
    private projectBinDir: string;
    private _runLock: boolean = false;
    private _currentStep: InstallerStep | null = null;
    private _running: boolean = false;
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
        return this._running;
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
        if (this._running) {
            throw new Error("Installer instance already running.");
        }
        const buildFile = await getWorkflowFile(this.projectBinDir);
        const buildConfig = await parseWorkflow(buildFile);
        this.steps = buildConfig.build.map(el => ({
            cmd: el,
            process: null,
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
        if (this._running || this._runLock) {
            throw new Error("Installer already running.");
        }
        this._runLock = true;
        cancel?.throwIfAborted();
        this._running = true;
        this._startTime = Date.now();
        this._eventReference = eventReference ?? null;
        const cancelHandler = () => {
            this.kill(true);
        };
        cancel?.addEventListener("abort", cancelHandler);
        //
        this.emit("start", eventReference);
        //
        const logDir = join(this.projectBinDir, "..", PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, `${this._startTime}${(eventReference == undefined || eventReference == null) ? "" : `-${eventReference}`}`);
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
                await using proc = shellExecuteAsync(step.cmd, this.projectBinDir);
                step.process = proc;
                this._currentStep = step;
                const file = join(logDir, `${stepIdx}.log`);
                await proc.redirectToFile(file);
                this.emit(STEP_EVENT, this._currentStep);
                await proc.waitForExit();
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
        this._running = false;
        //
        this.emit(EXIT_EVENT, this.success);
        //
        try {
            await this.saveLog(logDir, this._startTime, eventReference);
        }
        catch (err) {
            logger.logException(new Error("Installer log could not be saved", { cause: err }));
        }
        // Throw a wrapped error if the installer didn't complete with success.
        // This will be a lot more useful than throwing whatever happens on its own.
        this._runLock = false;
        if (this.success == false) {
            const ret = {
                project: this.projectBinDir,
                step: stepIdx,
                cmd: this.steps[stepIdx].cmd,
                exitCode: this.steps[stepIdx].process?.exitCode ?? null
            }
            throw new Error("Installer failed to complete.", { cause: ret });
        }
    }

    /**
     * Stops all steps' and their child processes.
     */
    public async kill(force?: boolean): Promise<void> {
        if (this.running == false) {
            return;
        }
        const errors: Error[] = [];
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

    /**
     * Gets the specified installation log for this project.
     * @param log If not given, the last available timestamp is used and the latest log will be returned.
     * @returns The full filepath string to the log file.
     */
    public async findLog(log?: string | number): Promise<string | null> {
        const files = await this.getLogs();
        const logFileName = searchProjectOutputFile(files, log);
        if (logFileName) {
            return join(this.projectBinDir, "..", PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, logFileName)
        }
        return null;
    }

    /**
     * Gets a list of all installation log files for this project.
     * @returns 
     */
    public async getLogs() {
        const logsDir = join(this.projectBinDir, "..", PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME);
        return await getAllProjectOutputFiles(logsDir);
    }

    private async saveLog(dir: string, time: number, ref?: string) {
        if (this._running) {
            throw new Error("InstallRunner is currently busy. Wait for the runner to complete before attempting to export.");
        }
        const log: InstallerLog = {
            time: time,
            ref: ref,
            steps: this.steps.map((el, idx) => ({
                cmd: el.cmd,
                log: `${idx}.log`,
                exitCode: el.process?.exitCode ?? null,
                start: el.process?.startTime ?? -1,
                end: el.process?.exitTime ?? -1
            }))
        };
        const file = join(dir, `result.json`);
        await writeFile(file, JSON.stringify(log));       
    }
}