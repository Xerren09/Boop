import { ChildProcess } from "child_process";
import EventEmitter from "events";
import shelljs from 'shelljs';
const { exec, config } = shelljs;
config.silent = true;

export function shellExecuteAsync(command: string, cwd: string, env?: any, silent: boolean = true) {
    const cmd = exec(command, { cwd: cwd, silent: silent, env: env, async: true });
    const ret: BoopProcess = new BoopProcess(cmd);
    return ret;
}

interface BoopProcessEvents {
    'output': (stream: "stdout" | "stderr", line: string) => void;
    'exit': (code: number | null) => void;
    'startup': (err: any) => void;
}

export interface BoopProcess {
    on<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    once<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    emit<EventType extends keyof BoopProcessEvents>(event: EventType, ...args: Parameters<BoopProcessEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProcessEvents>(event: EventType, listener: BoopProcessEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProcessEvents>(event?: EventType): this;
}

export class BoopProcess extends EventEmitter {

    private _process: ChildProcess;

    private _output: { stream: "stdout" | "stderr", line: string }[] = [];

    public get exitCode() : number | null {
        return this._process.exitCode;
    }

    public get exited(): boolean {
        return this.exitCode != null;
    }

    public get pid() {
        return this._process.pid;
    }

    public get childProcess() {
        return this._process;
    }

    public get outputSnapshot() {
        return [...this._output];
    }

    constructor(proc: ChildProcess) {
        super();
        this._process = proc;
        this.setupSpawnEvent();
        this._process.stdout?.on("data", this.onStdout);
        this._process.stderr?.on("data", this.onStderr);
        this._process.once("exit", (exitCode) => {
            this.emit("exit", exitCode);
            this._process.stdout?.removeAllListeners();//.removeListener("data", this.onStdout);
            this._process.stderr?.removeAllListeners();//.removeListener("data", this.onStderr);
            this.removeAllListeners("output");
            this.removeAllListeners("startup");
        });
    }

    private setupSpawnEvent() {
        const sucess = () => { 
            this._process.removeListener("error", error);
            this.emit("startup", undefined);
        };
        const error = (err) => {
            this._process.removeListener("spawn", sucess);
            this.emit("startup", err);
        }
        this._process.once("error", error);
        this._process.once("spawn", sucess);
    }

    private onStdout = (msg: any) => {
        const output: ProcessOutputEntry = {
            stream: "stdout",
            line: msg.toString()
        };
        this.emit("output", output.stream, output.line)
        this._output.push(output);
    }

    private onStderr = (msg: any) => {
        const output: ProcessOutputEntry = {
            stream: "stderr",
            line: msg.toString()
        };
        this.emit("output", output.stream, output.line)
        this._output.push(output);
    }

    kill() {
        this._process.kill('SIGINT');
    }
}

interface ProcessOutputEntry {
    stream: "stdout" | "stderr",
    line: string
}
