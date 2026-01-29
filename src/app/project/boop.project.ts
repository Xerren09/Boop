import { readdir } from "fs/promises";
import { join } from "path";
import { Router } from "express";
import EventEmitter from "events";
import winston from "winston";
import * as express from "express";

import type { WebhookEvent } from "../webhook.js";
import { PROJECT_BIN_DIR_NAME, PROJECT_ENV_FILE_NAME, PROJECT_EVENTS_FILE_NAME, PROJECT_FILE_NAME, PROJECT_LOG_FILE_NAME, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, PROJECTS_DIR } from "../constants.js";
import { InstallRunner } from "../shell/installRunner.js";
import { EnvFile } from "./env.js";
import { EventsFile } from "./eventLog.js";
import logger from "../../logger.js";
import { downloadRemote } from "../shell/git.js";

interface BoopProjectEvents {
    'deploy': (success: boolean) => void;
    'install': (installer: InstallRunner) => void;
}

export interface BoopProject {
    on<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    once<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    emit<EventType extends keyof BoopProjectEvents>(event: EventType, ...args: Parameters<BoopProjectEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProjectEvents>(event?: EventType): this;
}

// TODO: add instantiate static function

export abstract class BoopProject extends EventEmitter {
    /**
     * The root project directory where all the configuration files and project files are stored.
     */
    public get rootDir(): string {
        return join(PROJECTS_DIR, this.name);
    };
    /**
     * The root project files directory where the actual project binaries are stored.
     */
    public get binDir(): string {
        return join(this.rootDir, PROJECT_BIN_DIR_NAME);
    };
    protected get _eventsFilePath(): string {
        return join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_EVENTS_FILE_NAME);
    }
    protected get _envFilePath(): string {
        return join(this.rootDir, PROJECT_ENV_FILE_NAME);
    }
    protected get _projectFilePath(): string {
        return join(this.rootDir, PROJECT_FILE_NAME);
    }
    private readonly _name: string;
    /**
     * The name of this project. Same as the repository's name.
     */
    public get name(): string {
        return this._name;
    }

    protected _installer: InstallRunner;
    public get installer() {
        return this._installer;
    }

    /**
     * `true` if the project is currently running an installer process.
     */
    public get installing(): boolean {
        return this._installer.running;
    }

    /**
     * `true` if the project is available through a router and working without errors.
     */
    public abstract get deployed(): boolean;

    protected _router: Router | null;
    public get router(): Router | null {
        return this._router;
    }

    /**
     * The project's internal configuration (independent from the workflow config)
     */
    private readonly _config: ProjectConfig;

    public get type(): ProjectType {
        return this._config.type;
    }
    public get remoteUrl(): string {
        return this._config.repositoryURL;
    }

    protected readonly log: winston.Logger;

    public readonly environment: EnvFile;
    public readonly events: EventsFile;
    
    constructor(config: ProjectConfig) {
        super();
        this._name = config.repositoryURL.substring(config.repositoryURL.lastIndexOf('/') + 1)
        this._config = config;
        this.environment = new EnvFile(this._envFilePath);
        this.events = new EventsFile(this._eventsFilePath);
        //
        this._installer = new InstallRunner(this.binDir);
        //
        this.log = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors(),
                winston.format.metadata(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({
                    filename: join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME),
                    level: "info"
                })
            ],
        });
    }

    private _webhookLock: boolean = false;
    private _webhookQueue: WebhookEvent | undefined;

    /**
     * Handles an incoming Webhook event.
     * @param evt 
     */
    public onWebhookEvent(evt: WebhookEvent, res?: express.Response | undefined) {
        if (this._config.acceptBranch != evt.repository.branch)
        {
            const msg = `Event refused; wrong branch (accepts "${this._config.acceptBranch}" but got "${evt.repository.branch}").`;
            res?.status(422).send(msg);
            this.log.warn(msg);
            return;
        }
        if (this._webhookLock == false) {
            //
            this._webhookLock = true;
            this.log.info("Processing webhook event.");
            if (res !== undefined) {
                const msg = `Webhook event received and currently processing.`;
                res.status(202).send(msg);
            }
            this.events.add(evt);
            this.events.save().then(() => {
                //
                const handler = () => {
                    this.processWebhookEvent().finally(() => {
                        this._webhookLock = false;
                        if (this._webhookQueue != undefined) {
                            this.log.info("Webhook event processed; processing queue.");
                            this.onWebhookEvent(this._webhookQueue);
                            this._webhookQueue = undefined;
                        }
                        this.log.info("Webhook event processed.");
                    });
                }
                if (this.installing) {
                    this.once("deploy", handler);
                }
                else {
                    handler();
                }
            });
        }
        else {
            this.log.warn(`Webhook processor is busy; event added to queue${ this._webhookQueue != undefined ? `(discarding "${this._webhookQueue.time}")` : ""}.`);
            this._webhookQueue = evt;
            const msg = `Webhook event accepted into queue. If another event is received before the current one completes, this one will be discarded in favour of the new event.`;
            res?.status(202).send(msg);
        }
    }

    protected async processWebhookEvent(): Promise<void> {
        try {
            if (this.installing) {
                await this.installer.kill();
            }
            await this.stop();
            await downloadRemote(this.remoteUrl);
            await this.install();
            await this.deploy();
        }
        catch (e) {
            this.log.error(e);
        }
    }

    protected async install(): Promise<void> {
        this.SharedLog("info", `Install process started.`);
        await this.stop();
        if (this._installer.running) {
            await this._installer.kill();
        }

        try {
            await this._installer.loadConfiguration();
            this.emit("install", this._installer);
            await this._installer.run();
        }
        finally {
            if (this._installer.success == false) {
                this.log.error(`Installer failed. See "workflow-${this._installer.exitedAt}.json" for more info.`);
            }
            else {
                this.log.info(`Installer finished.`);
            }
        }
    }

    protected SharedLog(level: "info" | "error" | "warn", message: string, ...meta: any[]) {
        this.log[level](message, ...meta);
        logger[level](`'${this.name}': ${message}`, ...meta);
    }

    /**
     * Deploys the project and enables its router.
     * @returns 
     */
    public async deploy(): Promise<void> {
        if (this.deployed) {
            return;
        }
        try {
            if (this.installing == true) {
                throw new Error("Project is busy.");
            }
            await this._deploy();
            this.SharedLog("info", `Deployed.`);
        }
        catch (err) {
            const error = new Error(`Project failed to deploy.`, { cause: err });
            this.SharedLog("error", `Failed to deploy.`, error);
            this._router = null;
            throw error;
        }
        finally {
            this.emit("deploy", this.deployed);
        }
        
    }
    protected abstract _deploy(): Promise<void>;
    
    /**
     * Stops the project's handler and removes its router.
     */
    public async stop(): Promise<void> {
        if (this.deployed) {
            return;
        }
        try {
            await this._stop();
            this.SharedLog("info", `Stopped.`);
        }
        catch (err) {
            const error = new Error(`Project failed to deploy.`, { cause: err });
            this.SharedLog("error", `Failed to stop.`, error);
            throw error;
        }
        finally {
            this._router = null;
        }
    }
    protected abstract _stop(): Promise<void>;

    /**
     * Starts the project. Calls {@link stop} and {@link deploy} in a series.
     */
    public async restart(): Promise<void> {
        try {
            await this.stop();
            await this.deploy();
            this.SharedLog("info", `Restarted.`);
        }
        catch (err) {
            this.SharedLog("error", `Restart failed.`, err);
            throw err;
        }
    }

    /**
     * Gets the specified installation log for this project.
     * @param time If not given, the last available timestamp is used and the latest log will be returned.
     * @returns The full filepath string to the log file.
     */
    public async getInstallLog(time?: number): Promise<string | null> {
        const files = await this.getInstallLogs();
        let file: string | undefined = "";
        if (time == undefined) {
            try {
                time = Math.max(...files.map(el => Number(el.split("-")[1]!.split(".")[0])));
            }
            finally {
                file = `workflow-${time}.json`
            }
        }
        else {
            file = files.find(el => el == `workflow-${time}.json`);
        }
        if (file) {
            return join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, file);
        }
        return null;
    }

    /**
     * Gets a list of all installation log files for this project.
     * @returns 
     */
    public async getInstallLogs() {
        const installLogsDir = join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME);
        const items = await readdir(installLogsDir);
        const logs = items.filter(el => el.startsWith("workflow-") == true);
        return logs;
    }
}

export interface ProjectConfig {
    /**
     * The type of the project.
     * 
     * `webapp`: hosts static files
     * 
     * `service`: hosts a server side app
     */
    type: ProjectType,
    /**
     * The URL of the project's GitHub repository.
     */
    repositoryURL: string;
    /**
     * The branch's name events are accepted from.
     */
    acceptBranch: string;
}

export type ProjectType = 'webapp' | 'service';