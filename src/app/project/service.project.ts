import { downloadRemote } from "../shell/git.js";
import { shellExecuteAsync, type BoopProcess } from "../shell/shell.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { createServiceRouter } from "../routers/service.router.js";

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
                this._process = shellExecuteAsync(config.deploy.entry, this.binDir, this.environment.env as any);
                //
                this._process.once("startup", (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.log.debug(`Project process started (${this._process?.pid}).`);
                        const port = Number((this.environment.env["PORT"] ?? this.environment.env["port"]) ?? -1);
                        if (port !== -1) {
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
            await this._process.kill();
        }
    }
}