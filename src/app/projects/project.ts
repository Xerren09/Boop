import kill from "tree-kill";
import { WebhookEvent } from "../webhook.js";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { projectsFolderPath } from "../constants.js";
import { join } from "path";
import { createAppRouter } from "../routers/app.router.js";
import { Router } from "express";
import { createServiceRouter } from "../routers/service.router.js";
import { getWorkflowPath, parseWorkflow } from "../workflow/workflowParser.js";
import { downloadRemote } from "../workflow/clone.js";
import { deployService } from "../workflow/deploy.js";
import { ProjectInstaller } from "../workflow/workers/build.js";
import EventEmitter from "events";
import { BoopProcess } from "../workflow/shell.js";
import { activeProjects } from "./index.js";
import { logger } from "../logger.js";

interface BoopProjectEvents {
    'deploy': (success: boolean) => void;
    'install': (installer: ProjectInstaller) => void;
}

export interface BoopProject {
    on<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    once<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    emit<EventType extends keyof BoopProjectEvents>(event: EventType, ...args: Parameters<BoopProjectEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProjectEvents>(event?: EventType): this;
}

export class BoopProject extends EventEmitter {
    public readonly remoteUrl: string = "";
    /**
     * The root project directory where all the configuration files and project files are stored.
     */
    public get projectRootPath(): string {
        return join(projectsFolderPath, this.name);
    };
    /**
     * The root project files directory where the actual project binaries are stored.
     */
    public get projectFilesRootPath(): string {
        return join(this.projectRootPath, "files");
    };
    private get _eventsFilePath(): string {
        return join(this.projectRootPath, "events.json");
    }
    private get _projectFilePath(): string {
        return join(this.projectRootPath, "project.json");
    }
    /**
     * The name of this project. Same as the repository's name.
     */
    public readonly name: string = "";
    /**
     * The maximum number of Webhook events saved. This also controls the number of workflow logs saved.
     */
    private readonly _max_events: number = 25;
    /**
     * The list of previous webhook events.
     */
    public events: WebhookEvent[] = [];
    /**
     * Gets the latest webhook event.
     */
    public get lastEvent(): WebhookEvent | undefined {
        return this.events[this.events.length - 1] || undefined;
    }

    private _installer?: ProjectInstaller;
    public get installer() {
        return this._installer;
    }

    /**
     * `true` if the project is currently running an installer process.
     */
    public get installing(): boolean {
        return (this._installer != undefined && this._installer.running);
    }

    private _process?: BoopProcess;
    public get process() {
        return this._process;
    }

    /**
     * `true` if the project is available through a router and working without errors.
     */
    public get deployed(): boolean {
        if (this.type == "webapp") {
            return this._router != undefined;
        }
        else if (this.type == "service") {
            return this._router != undefined && this._process != undefined && this._process.exitCode == null;
        }
        return false;
    }

    public get lastDeployed(): number | null {
        return this._config.lastDeploy;
    }

    private _router?: Router;
    public get router(): Router | undefined {
        return this._router;
    }

    /**
     * The project's internal configuration (independent from the workflow config)
     */
    private _config: ProjectConfig;

    private _type: ProjectType;
    public get type(): ProjectType {
        return this._type;
    }

    /**
     * Gets a copy of the project's current environment variables.
     */
    public get env(): any {
        return JSON.parse(JSON.stringify(this._config.env));
    }
    
    constructor(name: string) {
        super();
        this.name = name;        
        if (existsSync(this.projectRootPath) == false || existsSync(this._projectFilePath) == false) {
            throw new Error(`No project with name ${name} could be found.`);
        }
        if (existsSync(this._eventsFilePath) == false) {
            writeFileSync(this._eventsFilePath, JSON.stringify(this.events));
        }
        const history = JSON.parse(readFileSync(this._eventsFilePath).toString()) as WebhookEvent[];
        this.events = history;
        const config = JSON.parse(readFileSync(this._projectFilePath).toString()) as ProjectConfig;
        this._config = config;
        this._type = this._config.type;
        this.remoteUrl = this._config.repositoryURL;
    }

    private _webhookLock: boolean = false;
    private _webhookEventQueue: WebhookEvent | undefined;

    /**
     * Handles an incoming Webhook event.
     * @param evt 
     */
    public onWebhookEvent(evt: WebhookEvent) {
        if (this._webhookLock == false) {
            //
            this._webhookLock = true;
            // Add event to history only if it is actually getting processed
            if (this.events.length > this._max_events) {
                this.events.shift();
            }
            this.events.push(evt);
            this.save();
            //
            if (this.installing) {
                this.once("deploy", (state) => {
                    this.processWebhookEvent().finally(() => {
                        if (this._webhookEventQueue != undefined) {
                            this.onWebhookEvent(this._webhookEventQueue);
                            this._webhookEventQueue = undefined;
                        }
                    });
                });
            }
            else {
                this.processWebhookEvent().finally(() => {
                    if (this._webhookEventQueue != undefined) {
                        this.onWebhookEvent(this._webhookEventQueue);
                        this._webhookEventQueue = undefined;
                    }
                });
            }
        }
        else {
            logger.warn(`Project ${this.name} webhook processor is busy; event sent to queue.`);
            this._webhookEventQueue = evt;
        }
    }

    private async processWebhookEvent() {
        if (this._webhookLock == false) {
            this._webhookLock = true;
        }
        try {
            await this.stop();
            await downloadRemote(this.name, this.remoteUrl);
            await this.install();
            this._webhookLock = false;
            await this.deploy();
        }
        catch (e) {
            if (e instanceof Error) {
                logger.error(`${e.message}${e.cause ? ` (cause: ${e.cause})` : undefined}`);
            }
            else {
                logger.error(e);
            }
        }
        finally {
            this._webhookLock = false;
        }
    }

    //
    // Control methods
    //

    // Wraps the deploy method in the proper error handler so we don't have 97 logger.error() lines
    public async start() {
        return this.deploy().then(() => {
            logger.info(`Project ${this.name} (${this.type}) started successfully.`);
        }).catch(e => {
            if (e instanceof Error) {
                logger.error(`${e.message}${e.cause ? ` (cause: ${e.cause})` : undefined}`);
            }
            else {
                logger.error(e);
            }
            throw e;
        });
    }

    /**
     * Deploys the project
     * @returns 
     */
    private async deploy() {
        if (this._webhookLock == true) {
            throw new Error("Project is busy.");
        }
        return new Promise<void>((resolve, reject) => {
            if (this.type == "webapp") {
                const entryPoint = parseWorkflow(getWorkflowPath(this.projectFilesRootPath)).deploy.entry;
                this._router = createAppRouter(this._config.name, this.projectFilesRootPath, entryPoint);
                this.emit("deploy", true);
                resolve();
            }
            else if (this.type == "service") {
                if (this._process == undefined || this._process.exitCode != null) {
                    this.loadEnvFromWorkflowFile();
                    let env = {
                        ...this.env
                    };
                    //
                    this._process = deployService(this.projectFilesRootPath, env);
                    //
                    this._process.once("startup", (err) => {
                        if (err) {
                            this.emit("deploy", false);
                            reject(err);
                        }
                        else {
                            logger.info(`Project ${this.name} service worker started (${this._process?.pid}).`);
                            this._router = createServiceRouter(this._config.name, env.PORT);
                            this.emit("deploy", true);
                            resolve();
                        }
                    });
                    this._process.once("exit", () => {
                        this.emit("deploy", false);
                    });
                }
                else {
                    this.emit("deploy", true);
                    resolve();
                }
            }
            this._config.lastDeploy = Date.now();
            this.save();
        });
    }

    /**
     * Stops and restarts the current project.
     * 
     * `service` projects will completely restart with a new child process.
     * 
     * `app` projects will have their router re-created.
     * @returns 
     */
    public async restart() {
        if (this._webhookLock == true || this._installer?.running) {
            throw new Error("Project is busy.")
        }
        await this.stop();
        await this.start();
    }

    /**
     * Stops the project if it is of type `service`.
     * @returns 
     */
    public stop() : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this._process != undefined && this._process.pid != undefined && this._process.exitCode == null) {
                kill(this._process.pid, (err) => {
                    if (err) {
                        reject(new Error(`Project ${this.name} could not be stopped.`, { cause: err}));
                    }
                    else {
                        logger.info(`Project ${this.name} stopped.`);
                        resolve();
                    }
                });
            }
            else {
                logger.info(`Project ${this.name} stop ignored; project has nothing to stop.`);
                resolve();
            }            
        });
    }

    /**
     * Stops the project and runs the installer workflow
     * @returns 
     */
    private async install() {
        await this.stop();
        if (this._installer) {
            this._installer.dispose();
        }
        //
        this._installer = new ProjectInstaller(this.projectFilesRootPath);
        this.emit("install", this._installer);
        //
        try {
            logger.info(`Project ${this.name} installing.`);
            await this._installer.run();
        }
        finally {
            if (this._installer.complete == false) {
                logger.error(`Project ${this.name} installer failed. See /projects/${this.name}/workflow-${this.lastEvent?.time}.json for more info.`);
            }
            else {
                logger.info(`Project ${this.name} installer completed.`);
            }
            this.saveInstallLog();
        }
    }

    private loadEnvFromWorkflowFile() {
        const configPath = getWorkflowPath(this.projectFilesRootPath);
        const config = parseWorkflow(configPath);
        if (config.deploy.env) {
            Object.keys(config.deploy.env).forEach(el => {
                this.setEnvKey(el, config.deploy.env![el]);
            });
        }
    }

    //
    // Environment
    //

    public setEnvKey(key: string, value: number | string | boolean) {
        this._config.env[key] = value;
        this.save();
    }

    public removeEnvKey(key: string) {
        delete this._config.env[key];
        this.save();
    }

    //
    // Data files
    //

    private save() {
        writeFileSync(this._projectFilePath, JSON.stringify(this._config, undefined, 4));
        writeFileSync(this._eventsFilePath, JSON.stringify(this.events, undefined, 4));
    }

    public getInstallLog(time?: number) {
        const files = readdirSync(this.projectRootPath).filter(el => el.startsWith("workflow-") == true);
        if (time == undefined) {
            time = Math.max(...files.map(el => Number(el.split("-")[1].split(".")[0])));
        }
        const file = files.find(el => el == `workflow-${time}.json`);
        if (file) {
            return JSON.parse(readFileSync(join(this.projectRootPath, file)).toString());
        }
        else {
            return undefined;
        }
    }

    public getInstallLogList() {
        return readdirSync(this.projectRootPath).filter(el => el.startsWith("workflow-") == true);
    }

    private saveInstallLog() {
        const workflowPath = join(this.projectRootPath, `workflow-${this.lastEvent?.time}.json`);
        if (this._installer) {
            writeFileSync(workflowPath, JSON.stringify(this._installer.export(), undefined, 4));
            // Remove old logs
            const logs = this.getInstallLogList();
            for (const log of logs) {
                const date = Number(log.split("-")[1].split(".")[0]);
                if (date < (this.events[0].time || 0)) {
                    rmSync(join(this.projectRootPath, log), { force: true });
                }
            }
        }
    }

    //
    // Static methods
    //

    /**
     * 
     * @param projectName The repository name of the project
     * @param remote The url of the remote repository
     * @param evt The initial webhook event that triggered the project's creation
     */
    public static createProject(event: WebhookEvent) {
        const projectName = event.repository.name;
        const remote = event.repository.url;
        const projectDir = join(projectsFolderPath, projectName);
        // Create project root folder
        if (existsSync(projectDir) == false) {
            mkdirSync(projectDir);
        }
        // Clone repository
        downloadRemote(projectName, remote).then(async () => {
            try {
                const configPath = getWorkflowPath(join(projectDir, "files"));
                const config = parseWorkflow(configPath);
                BoopProject.createProjectFile(projectName, remote, config.type);
                const project = new BoopProject(projectName);
                project.events.push(event);
                project.save();
                await project.install();
                await project.deploy();
                activeProjects.push(project);
            }
            catch (e) {
                if (e instanceof Error) {
                    logger.error(`${e.message}${e.cause ? ` (cause: ${e.cause})` : undefined}`);
                }
                else {
                    logger.error(e);
                }
            }
        });
    }

    private static createProjectFile(name: string, remoteUrl: string, type: ProjectType) : string {
        const projectFile: ProjectConfig = {
            name: name,
            repositoryURL: remoteUrl,
            type: type,
            env: {},
            lastDeploy: null
        }
        const projectPath = join(projectsFolderPath, name);
        if (existsSync(projectPath) == false) {
            mkdirSync(projectPath);
        }
        const filePath = join(projectPath, "project.json");
        if (existsSync(filePath) == false) {
            writeFileSync(filePath, JSON.stringify(projectFile));
        }
        return projectPath;
    }
}

interface ProjectConfig {
    /**
     * The type of the project.
     * 
     * `webapp`: hosts static files
     * 
     * `service`: hosts a server side app
     */
    type: ProjectType,
    /**
     * 
     */
    name: string,
    /**
     * 
     */
    repositoryURL: string;
    /**
     * 
     */
    env: {
        [key: string] : any
    };
    lastDeploy: null | number;
}

export type ProjectType = 'webapp' | 'service';