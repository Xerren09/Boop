import { shellExecuteAsync, type BoopProcess } from "../shell/shell.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_LOG_RESULT_FILE_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME } from "../constants.js";
import { once } from "node:events";
import { type EventLog, makeLogDirName, type ProcessLog } from "../../logger.js";

export class ServiceProject extends BoopProject {
    public override get deployed(): boolean {
        return this._process != null && this._process.exitCode == null;
    }
    private _process: BoopProcess | null = null;
    /**
     * The project's service process. May be stale if the project is stopped or not currently deployed; 
     * use {@link deployed|deployed(): boolean} to check if its is up to date.
     */
    public get process() {
        return this._process;
    }

    public get deployedAt(): number {
        return this._process?.startTime ?? -1;
    }
    public get stoppedAt(): number {
        return this._process?.exitTime ?? -1;
    }

    constructor(config: ProjectConfig){
        super(config);
    }

    /**
     * Starts the project's service process and creates a new proxy router to forward requests to it.
     * @returns 
     */
    protected async _deploy(eventReference?: string) : Promise<void> {
        if (this._process != null && this._process.exited == false) {
            // Already running
            return;
        }
        const configPath = await getWorkflowFile(this.binDir);
        const config = await parseWorkflow(configPath);
        if (config.deploy.env !== undefined) {
            Object.keys(config.deploy.env).forEach(el => {
                this.environment.set(el, config.deploy.env![el]);
            });
        }
        await this.environment.save();
        //
        this._process = shellExecuteAsync(config.deploy.entry, this.binDir, this.environment.variables as any);
        //
        const err = await once(this._process, "start");
        if (err.length != 0) {
            throw err[0];
        }
        this.log.debug(`Project process started.`, {pid: this._process?.pid});
        //
        await this.startLog(eventReference);
        //
        const port = Number(this.environment.get("PORT") ?? -1);
        // Even if no port is specified, the project might have a hardcoded one. 
        // This is a misconfiguration, but not a fatal error.
        if (port == -1 || Number.isNaN(port)) {
            this.log.warn(`No PORT environment variable is specified; can't create proxy router.`);
        }
        this._process.once("exit", (code) => {
            if (this._process!.wasKilled) {
                this.log.debug(`Project process exited.`, { pid: this._process?.pid, code: code, killed: true });
            }
            else {
                this.log.warn(`Project process exited unexpectedly.`, { pid: this._process?.pid, code: code, killed: false });
                this.stop();
            }
        });
    }

    /**
     * Stops the project's service process and all its children.
     * 
     * The process is sent a `SIGINT` signal, so graceful handled termination is expected.
     * @returns 
     */
    protected async _stop(): Promise<void> {
        if (this._process === null) {
            return;
        }
        if (this._process.exited == false) {
            await this._process.kill(true);
        }
    }

    private async saveResultLog(file: string, eventReference?: string) {
        try {
            const logDir = join(this.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, makeLogDirName(this.deployedAt, eventReference));
            const log: ServiceDeployLog = {
                time: this.deployedAt,
                ref: eventReference ?? null,
                process: {
                    cmd: this._process!.childProcess.spawnargs.join(" "),
                    startTime: this._process!.startTime,
                    exitTime: this._process!.exitTime,
                    exitCode: this._process!.exitCode,
                    log: join(logDir, `output.log`),
                    killed: this._process!.wasKilled
                }
            }
            await writeFile(file, JSON.stringify(log));
        }
        catch (err) {
            this.log.logException(err);
        }
    }

    private async startLog(eventReference?: string) {
        if (this._process?.exited) {
            throw new Error("Process already exited");
        }
        const logDir = join(this.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, makeLogDirName(this.deployedAt, eventReference));
        await mkdir(logDir);
        const processOutputLog = join(logDir, `output.log`);
        this._process?.redirectToFile(processOutputLog);
        const resultFile = join(logDir, PROJECT_LOG_RESULT_FILE_NAME);
        await this.saveResultLog(resultFile);
        this._process?.once("exit", async () => {
            await this.saveResultLog(resultFile);
        })
    }
}

interface ServiceDeployLog extends EventLog {
    time: number,
    ref?: string | null,
    process: ProcessLog
}