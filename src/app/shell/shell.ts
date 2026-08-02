import { ChildProcess, spawn } from "child_process";
import EventEmitter, { once } from "events";
import treeKill from "tree-kill";
import logger from "../../logger.js";
import { stripVTControlCharacters } from "util";
import { constants } from "os";
import { IAsyncDisposable } from "../utilities.js";
import { ENV_DISABLE_WEBHOOK_SECURITY_KEY, ENV_PORT_KEY, ENV_SECRET_KEY } from "../../constants.js";
import { Readable, Transform } from "stream";
import { createWriteStream, WriteStream } from "fs";

/**
 * Spawns a new shell and runs the given command.
 * @param command This command will be passed to the shell for execution.
 * @param cwd The working directory from which the process is spawned.
 * @param env The environment variables that will be visible to the process. On Windows these will be directly passed, while on Linux they will be merged with `process.env`.
 * @returns A {@link BoopProcess} wrapper that provides additional functions on top of {@link ChildProcess}.
 */
export function shellExecuteAsync(command: string, cwd: string, env?: NodeJS.ProcessEnv): BoopProcess {
    let _proc: ChildProcess | null = null;
    if (process.platform === "win32") {
        // Windows always knows where node is so we can just pass an empty env and it'll work
        _proc = spawn(command, {
            cwd: cwd,
            env: env ?? {},
            windowsHide: true,
            shell: true
        });
    }
    else if (process.platform === "linux") {
        const __env = { ...process.env };
        // Get rid of Boop specific variables
        delete __env[ENV_SECRET_KEY]; // Don't leak the secret
        delete __env[ENV_PORT_KEY];
        delete __env[ENV_DISABLE_WEBHOOK_SECURITY_KEY];
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
    'exit': (code: number | null) => void;
    'start': (err?: any) => void;
}

export interface BoopProcess {
    on<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    once<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    emit<EventType extends keyof BoopProcessEvents>(event: EventType, ...args: Parameters<BoopProcessEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProcessEvents>(event?: EventType): this;
}

/**
 * A single use wrapper for a {@link ChildProcess} spawned via {@link shellExecuteAsync}, 
 * designed for processes spawned with the `shell` option set to `true`.
 */
export class BoopProcess extends EventEmitter implements IAsyncDisposable {
    private _killTask: Promise<void> | null = null;
    private _process: ChildProcess;
    private _startTime: number = 0;
    private _endTime: number = 0;
    private _wasKilled: boolean = false;
    private _spawnFailed: boolean = false;
    private _exitCode: number | null = null;

    private _disposeController: AbortController = new AbortController();
    get disposed(): boolean {
        return this._disposeController.signal.aborted;
    }

    private _output: Transform;
    /**
     * The combined output stream of STDOUT and STDERR.
     */
    public get output() {
        return this._output as Readable;
    }

    /**
     * The exit code of the process, if it has exited.
     * 
     * The value may be different from the {@link childProcess}'s exitCode if it exited due to a signal.
     * See {@link signalExit} and {@link https://nodejs.org/api/util.html#utilconvertprocesssignaltoexitcodesignalcode|convertProcessSignalToExitCode}.
     * 
     * If the instance was disposed, the value will be `-1`.
     */
    public get exitCode() : number | null {
        return this._exitCode;
    }

    /**
     * Gets if the process terminated due to a signal.
     * 
     * If `true`, {@link exitCode} will be based on {@link https://nodejs.org/api/util.html#utilconvertprocesssignaltoexitcodesignalcode|convertProcessSignalToExitCode}.
     * 
     * To get the plain signal, use {@link https://nodejs.org/api/child_process.html#subprocesssignalcode|childProcess.signalCode}.
     */
    public get signalExit(): boolean {
        return this._process.signalCode != null;
    }

    /**
     * Gets if the process has exited.
     */
    public get exited(): boolean {
        return (this._spawnFailed || (this._exitCode != null));
    }

    /**
     * Gets if the process was sent a kill signal using {@link kill}(). 
     * 
     * Does not necessarily guarantee that the process was actually terminated.
     */
    public get wasKilled(): boolean {
        return this._wasKilled || this._process.killed;
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

    /**
     * The timestamp when the process started. Will be `0` if the process never spawned.
     */
    public get startTime() {
        return this._startTime;
    }

    /**
     * The timestamp when the process exited. Will be `0` if the process is still running, or if \[{@link Symbol.asyncDispose}]() was called.
     */
    public get exitTime() {
        return this._endTime;
    }

    constructor(proc: ChildProcess) {
        super();
        this._process = proc;
        this._process.once("error", this.onError);
        this._process.once("spawn", this.onSpawn);
        this._output = new Transform({
            transform(chunk, encoding, callback) {
                this.push(stripVTControlCharacters(chunk.toString()));
                callback();
            },
        });
        this._process.stdout?.pipe(this._output);
        this._process.stderr?.pipe(this._output);
        this._process.once("exit", this.onExit);
    }

    private onError = (err: Error) => {
        // Error only fires if node has trouble with the process. Because we use shellExecuteAsync,
        // we only care about spawn and send() errors. Kill is handled by our own kill method, and
        // no abort signal is passed on spawn so that won't happen.
        if (this._startTime === 0) {
            // Failed to spawn sprocess
            this.emit("start", err);
            // Do cleanup
            this._spawnFailed = true;
            this._process.removeListener("exit", this.onExit);
            this._process.removeListener("spawn", this.onSpawn);
        }
        // Will be an error for send() most likely
        logger.debug(`Process error.`, {
            pid: this.pid,
            args: this._process.spawnargs.join(" "),
            error: {
                message: err.message,
                cause: err.cause ?? null
            }
        });
    }

    private onSpawn = () => {
        this._startTime = Date.now();
        this.emit("start");
        logger.debug(`Process started.`, {
            args: this._process.spawnargs.join(" "),
            pid: this.pid
        });
    }

    private onExit = (exitCode: number | null, signal: string | null) => {
        this._endTime = Date.now();
        // See https://github.com/nodejs/node/blob/7bd2fea78b32e848d7e5ecc40d400c832a2fedf2/lib/internal/util.js#L410
        this._exitCode = exitCode === null ? (128 + constants.signals[signal!]) : exitCode;
        //
        this.emit("exit", this._exitCode);
        this._process.removeListener("error", this.onError);
        this._process.removeListener("spawn", this.onSpawn);
        //
        logger.debug(`Process exited.`, {
            pid: this.pid,
            exitCode: exitCode,
            signal: signal,
            ret: this._exitCode,
            killed: this.wasKilled
        });
    }

    /**
     * Creates a file and pipes {@link output} into it using a {@link WriteStream}.
     * @param filePath Path to the destination file. If it doesn't exist, the file will be automatically created.
     * @returns The WriteStream to the destination file. Will be automatically closed when {@link output} closes (when the process stops or is killed).
     */
    public redirectToFile(filePath: string): WriteStream {
        // This will be closed automatically on process exit when the handle gets closed
        const stream = createWriteStream(filePath, { flags: "w"});
        this._output.pipe(stream);
        return stream;
    }

    /**
     * Returns a promise that completes when the process exits.
     * @param cancel Optional `AbortSignal` used to cancel the promise.
     * @returns The exitcode of the process, or -1 if it failed to spawn. Will throw an error if cancelled or disposed.
     */
    async waitForExit(cancel?: AbortSignal): Promise<number> {
        this._disposeController.signal.throwIfAborted();
        // Resolve immediately if the process is dead
        if (this.exited == true) {
            return this.exitCode ?? -1;
        }
        try {
            const _signals = [this._disposeController.signal];
            if (cancel !== undefined) {
                _signals.push(cancel);
            }
            const _abortSignal = AbortSignal.any(_signals)
            const [exit, signal] = await Promise.race([
                once(this._process, "exit", { signal: _abortSignal }),
                once(this._process, "error", { signal: _abortSignal })]
            );
            if (exit instanceof Error) {
                // Error, failed to spawn
                return -1;
            }
            else {
                // Exit
                if (exit !== null || signal !== null) {
                    return this._process.exitCode ?? (128 + constants.signals[this._process.signalCode!]);
                }
            }
        }
        catch (err) {
            // These errors will be only for cancel or dispose.
            if (this._disposeController.signal.aborted) {
                this._disposeController.signal.throwIfAborted();
            }
            if (cancel?.aborted) {
                throw new Error("Cancelled", { cause: cancel.reason });
            }
            throw err;
        }
        return -1;
    }

    /**
     * Attempts to kill the process and all its children.
     * @param entireProcessTree If set to `true`, will attempt to kill all child processes as well as the main process. Defaults to `true`.
     * @param force If set to `true`, `SIGKILL` will be sent to the process. Defaults to `false` (`SIGTERM`).
     * @returns 
     */
    async kill(entireProcessTree: boolean = true, force: boolean = false): Promise<void> {
        if (this._spawnFailed || this._wasKilled || this.exited) {
            return Promise.resolve();
        }
        // Keep reference to the kill task and return it while its live on any duplicate calls to avoid
        // killing a process with the name pid that might spawn between two overlapping calls
        if (this._killTask == null) {
            this._killTask = new Promise((resolve, reject) => {
                if (this._process != undefined && this._process.pid !== undefined && this.exited == false) {
                    try {
                        process.kill(this._process.pid, 0);
                    }
                    catch {
                        // Process isnt running so there it nothing to stop, call this a win
                        return resolve();
                    }
                    const __signal = force === true ? 'SIGKILL' : 'SIGTERM';
                    this._wasKilled = true;
                    if (entireProcessTree === true) {
                        treeKill(this._process.pid, __signal, (err?: Error | null) => {
                            if (err) {
                                if (process.platform === "win32") {
                                    if ((err as KillError).code === 128) {
                                        // https://stackoverflow.com/questions/18682681/what-are-exit-codes-from-the-taskkill-utility
                                        // 128 is "no task found" in windows, meaning our process exited before kill went through
                                        return resolve();
                                    }
                                }
                                if (this.exited) {
                                    return resolve();
                                }
                                logger.debug(`Failed to kill process.`, {
                                    pid: this.pid,
                                    forced: force,
                                    error: err,
                                    args: this._process.spawnargs.join(" ")
                                });
                                reject(new Error(`Process "${this._process.spawnargs.join(" ")}" (${this.pid}) could not be stopped.`, { cause: err }));
                            }
                            else {
                                resolve();
                            }
                        });
                    }
                    else {
                        try {
                            const result = this._process.kill(__signal);
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
            this._killTask.finally(() => { this._killTask = null; });
        }
        return this._killTask;
    }

    async [Symbol.asyncDispose]() {
        if (this.disposed) {
            return;
        }
        // Special case for dispose.
        if (this._exitCode === null) {
            this._exitCode = -1;
        }
        try {
            // Use our own kill instead of the normal one because we want everything gone.
            await this.kill(true, true);
        }
        finally {
            // If kill threw an error we're in an invalid state, so just clean up.
            // Abort all waitForExit instances with a rejection.
            this._disposeController.abort(new Error("Disposed"));
            // Remove event listeners
            this._process.removeListener("error", this.onError);
            this._process.removeListener("spawn", this.onSpawn);
            this._process.removeListener("exit", this.onExit);
            // Clean up output stream
            this._process.stdout?.unpipe(this._output);
            this._process.stderr?.unpipe(this._output);
            this._output.destroy();
        }
    }
}

/**
 * Returned by {@link treeKill} on `win32` when its internal {@link https://github.com/pkrumins/node-tree-kill/blob/cb478381547107f5c53362668533f634beff7e6e/index.js#L29|`exec("taskkill")`} fails.
 * 
 * See {@link https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback|child_process.exec callback documentation} 
 */
interface KillError extends Error {
    code: number | null,
    signal: string | null
}