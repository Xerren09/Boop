import { shellExecuteAsync, type BoopProcess } from "../shell/shell.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { createServiceRouter } from "../routers/service.router.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME } from "../../constants.js";
import { getAllProjectOutputFiles, searchProjectOutputFile } from "../utilities.js";
import { once } from "node:events";

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
        //
        this._process = shellExecuteAsync(config.deploy.entry, this.binDir, this.environment.variables as any);
        //
        const err = await once(this._process, "start");
        if (err.length != 0) {
            throw err[0]; // handled in Stop() proper
        }
        this.log.debug(`Project process started (${this._process?.pid}).`);
        //
        this._process.redirectToFile(join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, `${this.deployedAt}.log`));
        //
        const port = Number(this.environment.get("PORT") ?? -1);
        // Even if no port is specified, the project might have a hardcoded one. 
        // This is a misconfiguration, but not a fatal error.
        if (port > -1) {
            this._router = createServiceRouter(this.name, port);
        }
        else {
            this.log.warn(`No PORT environment variable is specified; can't create proxy router.`);
        }
        this._process.once("exit", (code) => {
            this._router = null;
            if (this._process.wasKilled == false) {
                this.log.warn(`Project process exited (${this._process?.pid}).`, { code: code });
            }
            else {
                this.log.info(`Project process exited (${this._process?.pid}).`, { code: code });
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
        }
    }

    /**
     * Gets the specified deployment log for this project.
     * @param log If not given, the last available timestamp is used and the latest log will be returned.
     * @returns The full filepath string to the log file.
     */
    public async findLog(log?: string | number): Promise<string | null> {
        const files = await this.getLogs();
        const file = searchProjectOutputFile(files, log);
        if (file) {
            return join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, file)
        }
        return null;
    }

    /**
     * Gets a list of all deployment log files for this project.
     * @returns 
     */
    public async getLogs() {
        const installLogsDir = join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME);
        return await getAllProjectOutputFiles(installLogsDir);
    }
}