import { BoopProcess, shellExecuteAsync } from "./shell.js";
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import EventEmitter from "events";
import { join } from "path";
import { writeFile } from "fs/promises";
import type { ProcessOutputLine } from "./processOutput.js";
import { PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "../../constants.js";
import { getAllProjectOutputFiles, makeProjectOutputFileName, searchProjectOutputFile } from "../utilities.js";

const STEP_EVENT = "step";
const STEP_EXIT_EVENT = "stepExit";
const EXIT_EVENT = "exit";

interface InstallRunnerEvents {
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
    log: {
        cmd: string,
        output: ProcessOutputLine[],
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
    private _currentStep: InstallerStep | null = null;
    private _running: boolean = false;
    private _endTime: number = 0;
    private _startTime: number = 0;
    private _referenceTime: number = -1;

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
     * Returns the reference timestamp fr the event that triggered the runner, if set. 
     * 
     * Will be `-1` if not given during {@link run|run()}.
     */
    public get referenceTime(): number {
        return this._referenceTime;
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
     * Use {@link loadConfiguration} to load the current build file.
     * @returns 
     */
    public async run(referenceTime?: number): Promise<void> {
        if (this._running) {
            throw new Error("Installer already running.");
        }
        this._running = true;
        this._startTime = Date.now();
        this._referenceTime = referenceTime ?? -1;
        let stepIdx = 0;
        for (const step of this.steps) {
            try {
                const proc = shellExecuteAsync(step.cmd, this.projectBinDir);
                step.process = proc;
                this._currentStep = step;
                this.emit(STEP_EVENT, this._currentStep);
                await proc.waitForExit();
                stepIdx++;
            }
            catch (err) {
                // This is just an exit code, the error later is more useful
            }
            finally {
                this.emit(STEP_EXIT_EVENT, step);
                if (step.process == null || step.process.exitCode != 0) {
                    break;
                }
            }
        }
        this._endTime = Date.now();
        this._currentStep = null;
        this._running = false;
        //
        this.emit(EXIT_EVENT, this.success);
        await this.saveFile();
        if (this.success == false) {
            const ret = {
                step: stepIdx,
                cmd: this.steps[stepIdx].cmd,
                exitCode: this.steps[stepIdx].process.exitCode ?? null
            }
            throw new Error("Installer failed to complete.", { cause: ret });
        }
    }

    /**
     * Returns the whole install process as a json. Will fail if the runner is currently running.
     * @returns 
     */
    public asJSON() {
        if (this._running) {
            throw new Error("Installer is currently busy. Wait for the runner to complete before attempting to export.");
        }
        const workflow: InstallerLog = {
            time: this._endTime,
            log: this.steps.map(el => ({
                cmd: el.cmd,
                output: el.process?.output.lines ?? [],
                exitCode: el.process?.exitCode ?? null,
                start: el.process?.startTime ?? -1,
                end: el.process?.exitTime ?? -1
            }))
        };
        return JSON.stringify(workflow);
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

    private async saveFile() {
        if (this._running) {
            throw new Error("InstallRunner is currently busy. Wait for the runner to complete before attempting to export.");
        }
        const log = this.asJSON();
        const file = join(this.projectBinDir, "..", PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, makeProjectOutputFileName(this._referenceTime === -1 ? this._startTime : this._referenceTime));
        await writeFile(file, log);       
    }
}