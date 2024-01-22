import { BoopProcess, shellExecuteAsync } from "../shell.js";
import { getWorkflowPath, parseWorkflow } from "../workflowParser.js";
import EventEmitter from "events";

const STEP_EVENT = "step";
const EXIT_EVENT = "exit";

interface ProjectInstallerEvents {
    'exit': (success: boolean) => void;
    'step': (step: InstallerStep) => void;
}

export interface ProjectInstaller {
    on<EventType extends keyof ProjectInstallerEvents>(event: EventType, listener: ProjectInstallerEvents[EventType]): this;
    once<EventType extends keyof ProjectInstallerEvents>(event: EventType, listener: ProjectInstallerEvents[EventType]): this;
    emit<EventType extends keyof ProjectInstallerEvents>(event: EventType, ...args: Parameters<ProjectInstallerEvents[EventType]>): boolean;
    removeListener<EventType extends keyof ProjectInstallerEvents>(event: EventType, listener: ProjectInstallerEvents[EventType]): this;
    removeAllListeners<EventType extends keyof ProjectInstallerEvents>(event?: EventType): this;
}

export class ProjectInstaller extends EventEmitter {
    private cwd: string;
    private _currentStep: InstallerStep | null = null;
    private _running: boolean = false;

    public get currentStep() {
        return this._currentStep;
    }

    public steps: InstallerStep[] = [];

    public get running(): boolean {
        return this._running;
    }

    public get complete(): boolean {
        return this.steps.map(el => (el.process != null && el.process.exitCode == 0)).every(el => el == true);
    }

    constructor(cwd: string) {
        super();
        this.cwd = cwd;
        this.steps = parseWorkflow(getWorkflowPath(cwd)).build.map(el => ({
            cmd: el,
            process: null
        }));
    }

    public run() {
        if (this._running == true) {
            throw new Error("Installer is already running.");
        }
        return new Promise<void>(async (resolve, reject) => {
            this._running = true;
            for (const step of this.steps) {
                const proc = shellExecuteAsync(step.cmd, this.cwd);
                step.process = proc;
                this._currentStep = step;
                this.emit(STEP_EVENT, this._currentStep);
                try {
                    await this.promisifyProcess(proc);
                }
                catch (err) {
                    // TODO: handle installer step error to the remote console can see it as well
                }
                finally {
                    if (proc.exitCode != 0) {
                        break;
                    }
                }
            }
            this._currentStep = null;
            this._running = false;
            this.emit(EXIT_EVENT, this.complete);
            if (this.complete == true) {
                // Resolve if we have done all the steps, and the last one exited with 0
                resolve();
            }
            else {
                reject("Project installer failed.");
            }
        });
    }

    public export() {
        const workflow = {
            time: Date.now(),
            log: this.steps.map(el => ({
                cmd: el.cmd,
                output: el.process?.outputSnapshot || [],
                exit: el.process?.exitCode
            }))
        };
        return workflow;
    }

    /**
     * Stops all steps and removes all event listeners to free the resources allocated to this instance.
     */
    public dispose() {
        for (const step of this.steps) {
            step.process?.removeAllListeners();
            step.process?.kill();
        }
        this.emit("exit", this.complete);
        this.removeAllListeners();
    }

    private promisifyProcess(proc: BoopProcess) {
        return new Promise<void>((resolve, reject) => {
            proc.once("exit", (code: number | null) => {
                if (code != null && code == 0) {
                    resolve();
                }
                else if (code != null && code != 0) {
                    reject();
                }
            });
        });
    }
}

export interface InstallerStep {
    cmd: string,
    process: null | BoopProcess
}