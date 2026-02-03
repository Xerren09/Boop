import { ChildProcess, spawn } from "child_process";
import EventEmitter from "events";
import { ProcessOutput, type ProcessOutputLine } from "./processOutput.js";
import treeKill from "tree-kill";
import logger from "../../logger.js";
import { stripVTControlCharacters } from "util";

/**
 * Spawns a new shell and runs the given command.
 * @param command This command will be passed to the shell for execution.
 * @param cwd 
 * @param env 
 * @returns 
 */
export function shellExecuteAsync(command: string, cwd: string, env?: NodeJS.ProcessEnv): BoopProcess {
    const proc = spawn(command, {
        cwd: cwd,
        env: env ?? {},
        windowsHide: true,
        shell: true,
    });
    const ret: BoopProcess = new BoopProcess(proc);
    return ret;
}

interface BoopProcessEvents {
    'output': (stream: "stdout" | "stderr", line: string) => void;
    'exit': (code: number | null) => void;
    'startup': (err?: any) => void;
}

export interface BoopProcess {
    on<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    once<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    emit<EventType extends keyof BoopProcessEvents>(event: EventType, ...args: Parameters<BoopProcessEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProcessEvents>(event?: EventType): this;
}

/**
 * A single use wrapper for a ChildProcess spawned via {@link shellExecuteAsync}.
 */
export class BoopProcess extends EventEmitter {

    private _process: ChildProcess;
    private _startTime: number = 0;
    private _endTime: number = 0;
    private _wasKilled: boolean = false;

    public readonly Output: ProcessOutput;

    public get exitCode() : number | null {
        return this._process.exitCode;
    }

    /**
     * Gets if the process has exited (exitcode set)
     */
    public get exited(): boolean {
        return this.exitCode != null;
    }

    /**
     * Gets if the process was sent a kill signal using {@link kill}. 
     * 
     * Does not necessarily guarantee that the process was actually terminated.
     */
    public get wasKilled(): boolean {
        return this._wasKilled;
    }

    public get pid() {
        return this._process.pid;
    }

    /**
     * The underlying NodeJS ChildProcess
     */
    public get childProcess() {
        return this._process;
    }

    public get startTime() {
        return this._startTime;
    }
    public get exitTime() {
        return this._endTime;
    }

    constructor(proc: ChildProcess) {
        super();
        this.Output = new ProcessOutput();
        this._process = proc;
        this._process.once("error", this.onError);
        this._process.once("spawn", this.onSpawn);
        this._process.stdout?.on("data", this.onStdout);
        this._process.stderr?.on("data", this.onStderr);
        this._process.once("exit", this.onExit);
    }

    private onStdout = (msg: any) => {
        const line = stripVTControlCharacters(msg.toString());
        const output: ProcessOutputLine = {
            stream: "stdout",
            line: line
        };
        this.Output.addLine("stdout", line);
        this.emit("output", output.stream, output.line);
    }

    private onStderr = (msg: any) => {
        const line = stripVTControlCharacters(msg.toString());
        const output: ProcessOutputLine = {
            stream: "stderr",
            line: line
        };
        this.Output.addLine("stderr", line);
        this.emit("output", output.stream, output.line);
    }

    private onError = (err: Error) => {
        if (this._startTime === 0) {
            // failed to spawn
            this.emit("startup", err);
            //
            this._process.stdout?.removeListener("data", this.onStdout);
            this._process.stderr?.removeListener("data", this.onStderr);
            this._process.removeListener("exit", this.onExit);
            this._process.removeListener("spawn", this.onSpawn);
        }
        logger.debug(`Process error (${this.pid})`, {
            pid: this.pid,
            error: {
                message: err.message,
                cause: err.cause ?? null
            }
        });
    }

    private onSpawn = () => {
        this._startTime = Date.now();
        this.emit("startup");
        logger.debug(`Process started (${this.pid})`, {
            args: this._process.spawnargs.join(" "),
            pid: this.pid
        });
    }

    private onExit = (exitCode: number | null, signal: string | null) => {
        this._endTime = Date.now();
        this.emit("exit", exitCode);
        this._process.stdout?.removeListener("data", this.onStdout);
        this._process.stderr?.removeListener("data", this.onStderr);
        this._process.removeListener("error", this.onError);
        this._process.removeListener("spawn", this.onSpawn);
        //
        logger.debug(`Process exited (${this.pid})`, {
            pid: this.pid,
            exitCode: exitCode,
            signal: signal,
        });
    }

    /**
     * Returns a promise that completes when the process exits. Rejects with the exitcode if it is not `0`.
     * @returns On Reject, returns the exitcode or null.
     */
    asPromise(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Resolve immediately if the process is dead
            if (this.exited == true) {
                return this.exitCode === 0 ? resolve() : reject(this.exitCode);
            }
            this._process.once("exit", (code: number | null) => {
                if (code == 0) {
                    resolve();
                }
                else {
                    reject(code);
                }
            });
        });
    }

    /**
     * Attempts to kill the process and all its children.
     * @param forced If set to `true`, `SIGKILL` will be sent to the process. Defaults to `false` (`SIGINT`).
     * @returns 
     */
    async kill(forced: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process != undefined && this._process.pid !== undefined && this.exited == false) {
                try {
                    process.kill(this._process.pid, 0);
                }
                catch {
                    // Process isnt running so there it nothing to stop, call this a win
                    return resolve();
                }
                const signal = forced === true ? 'SIGKILL' : 'SIGTERM';
                this._wasKilled = true;
                treeKill(this._process.pid, signal, (err: any) => {
                    if (err) {
                        reject(new Error(`Process "${this._process.spawnargs}" (${this.pid}) could not be stopped.`, { cause: err }));
                        logger.debug(`Failed to kill process (${this.pid})`, {
                            pid: this.pid,
                            forced: forced,
                            error: err
                        });
                    }
                    else {
                        resolve();
                        logger.debug(`Killed process (${this.pid})`, {
                            pid: this.pid,
                            forced: forced
                        });
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
}
