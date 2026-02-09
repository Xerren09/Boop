import { ChildProcess, spawn } from "child_process";
import EventEmitter from "events";
import { ProcessOutput, type ProcessOutputLine } from "./processOutput.js";
import treeKill from "tree-kill";
import logger from "../../logger.js";
import { stripVTControlCharacters } from "util";
import { constants } from "os";
import { ENV_DISABLE_WEBHOOK_SECURITY, ENV_PORT, ENV_SECRET } from "../constants.js";

/**
 * Spawns a new shell and runs the given command.
 * @param command This command will be passed to the shell for execution.
 * @param cwd The working directory from which the process is spawned.
 * @param env The environment variables that will be visible to the process. On Windows these will be directly passed, while on Linux they will be merged with `process.env`.
 * @returns A {@link BoopProcess} wrapper that provides additional functions on top of {@link ChildProcess}.
 */
export function shellExecuteAsync(command: string, cwd: string, env?: NodeJS.ProcessEnv): BoopProcess {
    let _proc: ChildProcess = null;
    if (process.platform === "win32") {
        // Windows always know where node is so we can just pass an empty env and it'll work
        _proc = spawn(command, {
            cwd: cwd,
            env: env ?? {},
            windowsHide: true,
            shell: true,
        });
    }
    else if (process.platform === "linux") {
        const __env = { ...process.env };
        // Get rid of Boop specific variables
        delete __env[ENV_SECRET]; // Don't leak the secret
        delete __env[ENV_PORT];
        delete __env[ENV_DISABLE_WEBHOOK_SECURITY];
        _proc = spawn(command, {
            cwd: cwd,
            shell: true,
            env: {
                ...__env,
                ...env
            }
        });
    }
    else {
        throw new Error("Unsupported platform.");
    }
    const ret: BoopProcess = new BoopProcess(_proc);
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
    private _exitCode: number | null = null;


    public readonly output: ProcessOutput;
    public get exitCode() : number | null {
        return this._exitCode;
    }

    /**
     * Gets if the process terminated due to a signal.
     * 
     * If `true`, {@link exitCode} will be based on {@link https://nodejs.org/api/util.html#utilconvertprocesssignaltoexitcodesignalcode|convertProcessSignalToExitCode}.
     */
    public get signalExit(): boolean {
        return this._process.signalCode != null;
    }

    /**
     * Gets if the process has exited.
     */
    public get exited(): boolean {
        return this._exitCode != null;
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
        // See https://github.com/nodejs/node/blob/7bd2fea78b32e848d7e5ecc40d400c832a2fedf2/lib/internal/util.js#L410
        this._exitCode = exitCode === null ? (128 + constants.signals[signal]) : exitCode;
        //
        this.emit("exit", this._exitCode);
        this._process.stdout?.removeListener("data", this.onStdout);
        this._process.stderr?.removeListener("data", this.onStderr);
        this._process.removeListener("error", this.onError);
        this._process.removeListener("spawn", this.onSpawn);
        //
        logger.debug(`Process exited (${this.pid})`, {
            pid: this.pid,
            exitCode: exitCode,
            signal: signal,
            ret: this._exitCode
        });
    }

    /**
     * Returns a promise that completes when the process exits. Rejects with the exitcode if it is not `0`.
     * @returns On Reject, returns the exitcode or null.
     */
    asPromise(): Promise<void> {
        // Resolve immediately if the process is dead
        if (this.exited == true) {
            return this.exitCode === 0 ? Promise.resolve() : Promise.reject(this.exitCode);
        }
        return new Promise<void>((resolve, reject) => {
            const __exit = (code: number | null) => {
                this._process?.removeListener("error", __error);
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(code);
                }
            }
            const __error = (error?: Error) => {
                this._process?.removeListener("exit", __exit);
                reject(error);
            }
            this._process.once("exit", __exit);
            this._process.once("error", __exit);
        });
    }

    /**
     * Attempts to kill the process and all its children.
     * @param entireProcessTree If set to `true`, will attempt to kill all child processes as well as the main process. Defaults to `true`.
     * @param force If set to `true`, `SIGKILL` will be sent to the process. Defaults to `false` (`SIGTERM`).
     * @returns 
     */
    async kill(entireProcessTree: boolean = true, force: boolean = false): Promise<void> {
        if (this._wasKilled || this.exited) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            if (this._process != undefined && this._process.pid !== undefined && this.exited == false) {
                try {
                    process.kill(this._process.pid, 0);
                }
                catch {
                    // Process isnt running so there it nothing to stop, call this a win
                    return resolve();
                }
                const signal = force === true ? 'SIGKILL' : 'SIGTERM';
                this._wasKilled = true;
                if (entireProcessTree === true) {
                    treeKill(this._process.pid, signal, (err: any) => {
                        if (err) {
                            reject(new Error(`Process "${this._process.spawnargs}" (${this.pid}) could not be stopped.`, { cause: err }));
                            logger.debug(`Failed to kill process (${this.pid})`, {
                                pid: this.pid,
                                forced: force,
                                error: err,
                                args: this._process.spawnargs
                            });
                        }
                        else {
                            resolve();
                            logger.debug(`Killed process (${this.pid})`, {
                                pid: this.pid,
                                forced: force
                            });
                        }
                    });
                }
                else {
                    try {
                        const result = this._process.kill(signal);
                        result ? resolve() : reject();
                    }
                    catch (err) {
                        reject(err);
                    }
                }
            }
            else {
                resolve();
            }
        });
    }
}
