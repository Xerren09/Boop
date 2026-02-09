import { shellExecuteAsync, type BoopProcess } from "../shell/shell.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { createServiceRouter } from "../routers/service.router.js";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME } from "../constants.js";
import { makeProjectOutputFileName, ProjectOutputLogfileRegex } from "../utilities.js";

export class ServiceProject extends BoopProject {
    public override get deployed(): boolean {
        return this._router != undefined && this._process != undefined && this._process.exitCode == null;
    }
    private _process?: BoopProcess;
    /**
     * The project's service process. May be stale if the project is stopped or not currently deployed; 
     * use {@link deployed|deployed(): boolean} to check if its is up to date.
     */
    public get process() {
        return this._process;
    }

    constructor(config: ProjectConfig){
        super(config);
    }

    /**
     * Starts the project's service process and creates a new proxy router to forward requests to it.
     * @returns 
     */
    protected async _deploy() : Promise<void> {
        if (this._process != undefined && this._process.exited == false) {
            // Already running
            return;
        }
        const configPath = await getWorkflowFile(this.binDir);
        const config = await parseWorkflow(configPath);
        if (config.deploy.env !== undefined) {
            Object.keys(config.deploy.env).forEach(el => {
                this.environment.set(el, config.deploy.env[el]);
            });
        }
        await this.environment.save();
        return new Promise<void>((resolve, reject) => {
            if (this._process == undefined || this._process.exitCode != null) {
                //
                this._process = shellExecuteAsync(config.deploy.entry, this.binDir, this.environment.variables as any);
                //
                this._process.once("startup", (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.log.debug(`Project process started (${this._process?.pid}).`);
                        const port = Number(this.environment.get("PORT") ?? -1);
                        if (port > -1) {
                            this._router = createServiceRouter(this.name, port);
                        }
                        else {
                            this.SharedLog("warn", `No PORT environment variable is specified; can't create proxy router.`);
                        }
                        resolve();
                    }
                });
                this._process.once("exit", (code) => {
                    this._router = null;
                    if (this._process.wasKilled == false) {
                        this.SharedLog("warn", `Project process exited (${this._process?.pid}).`, { code: code });
                    }
                    else {
                        this.log.warn(`Project process exited (${this._process?.pid}).`, { code: code });
                    }
                });
            }
            else {
                resolve();
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
        if (this._process === undefined) {
            return;
        }
        if (this._process.exited == false) {
            await this._process.kill(true);
            //
            const file = join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, `${Date.now()}.json`);
            const data = JSON.stringify(this._process.output.lines)
            await writeFile(file, data);
        }
    }

    /**
     * Gets the specified deployment log for this project.
     * @param log If not given, the last available timestamp is used and the latest log will be returned.
     * @returns The full filepath string to the log file.
     */
    public async findLog(log?: string | number): Promise<string | null> {
        const files = await this.getLogs();
        let logFileName: string | undefined = "";
        if (files.length == 0) {
            return null;
        }
        if (log == undefined) {
            const num = Math.max(...files.map(el => Number(ProjectOutputLogfileRegex.exec(el)[0])));
            logFileName = makeProjectOutputFileName(num);
        }
        if (typeof log === "number") {
            const name: string = makeProjectOutputFileName(log);
            logFileName = files.find(el => el === name);
        }
        else if (typeof log === "string") {
            logFileName = files.find(el => el === log);
        }
        if (logFileName) {
            return join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, logFileName)
        }
        return null;
    }

    /**
     * Gets a list of all deployment log files for this project.
     * @returns 
     */
    public async getLogs() {
        const installLogsDir = join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME);
        const files = await readdir(installLogsDir);
        const logs = files.filter(file => ProjectOutputLogfileRegex.test(file) == true);
        return logs;
    }
}