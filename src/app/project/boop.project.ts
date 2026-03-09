import { join } from "path";
import { Router } from "express";
import EventEmitter from "events";
import * as express from "express";

import type { WebhookEvent } from "../webhook.js";
import { PROJECT_BIN_DIR_NAME, PROJECT_ENV_FILE_NAME, PROJECT_EVENTS_FILE_NAME, PROJECT_FILE_NAME, PROJECT_LOGS_DIR_NAME, PROJECTS_DIR } from "../../constants.js";
import { InstallRunner } from "../shell/installRunner.js";
import { EnvFile } from "./env.js";
import { EventsFile } from "./eventLog.js";
import logger, { BoopLogger, createProjectLogger } from "../../logger.js";
import { downloadRemote } from "../shell/git.js";
import { getProjectNameFromRemote, IAsyncDisposable, isDevEnv } from "../utilities.js";

interface BoopProjectEvents {
    'deploy': (success: boolean) => void;
    'stop': () => void;
    'install': (installer: InstallRunner) => void;
}

export interface BoopProject {
    on<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    once<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    emit<EventType extends keyof BoopProjectEvents>(event: EventType, ...args: Parameters<BoopProjectEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProjectEvents>(event?: EventType): this;
}

export abstract class BoopProject extends EventEmitter implements IAsyncDisposable {
    /**
     * The project's internal configuration (independent from the workflow config)
     */
    private readonly _config: ProjectConfig;
    private readonly _name: string;
    private _webhookLock: boolean = false;
    private _webhookQueue: WebhookEvent | null;
    protected readonly log: BoopLogger;
    protected _installer: InstallRunner;
    protected _router: Router | null;
    private _disposed: boolean = false;

    protected get _eventsFilePath(): string {
        return join(this.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_EVENTS_FILE_NAME);
    }
    protected get _envFilePath(): string {
        return join(this.rootDir, PROJECT_ENV_FILE_NAME);
    }
    protected get _projectFilePath(): string {
        return join(this.rootDir, PROJECT_FILE_NAME);
    }

    get disposed(): boolean {
        return this._disposed;
    }

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

    /**
     * The name of this project. Same as the repository's name.
     */
    public get name(): string {
        return this._name;
    }

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

    /**
     * The express router serving this project when deployed. Will be `null` if not deployed.
     */
    public get router(): Router | null {
        return this._router;
    }

    /**
     * The internal type of the project, which determines how it behaves. See {@link ProjectType}.
     */
    public get type(): ProjectType {
        return this._config.type;
    }

    /**
     * This project's GitHub repository's URL.
     */
    public get remoteUrl(): string {
        return this._config.repositoryURL;
    }

    /**
     * Environment variables set for this project. They will be passed to the launch process during {@link deploy}.
     */
    public readonly environment: EnvFile;

    /**
     * Contains the list of recent WebhookEvents this project received.
     */
    public readonly webhookEvents: EventsFile;
    
    constructor(config: ProjectConfig) {
        super();
        this._name = getProjectNameFromRemote(config.repositoryURL);
        this._config = config;
        this.environment = new EnvFile(this._envFilePath);
        this.webhookEvents = new EventsFile(this._eventsFilePath);
        //
        this._installer = new InstallRunner(this.binDir);
        //
        this.log = createProjectLogger(this.rootDir);
    }

    /**
     * Handles an incoming Webhook event.
     * 
     * WARN: this is designed to consume errors and will not throw.
     * @param evt The event that triggered the handler.
     * @param res Optional `express.Response` event used to provide immediate configuration response (like if the branch is correct). Does not actually wait for completion of the handler.
     */
    public async onWebhookEvent(evt: WebhookEvent, res?: express.Response | undefined) {
        if (isDevEnv() == false) {
            if (this.webhookEvents.exists(evt.id)) {
                const msg = `Event refused; repeat delivery.`;
                res?.status(400).send(msg);
                this.log.warn(msg, { event: evt.id });
                return;
            }
        }
        if (this._config.acceptBranch != evt.repository.branch)
        {
            const msg = `Event refused; wrong branch (accepts "${this._config.acceptBranch}" but got "${evt.repository.branch}").`;
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422
            res?.status(422).send(msg);
            this.log.warn(msg, { event: evt.id });
            return;
        }
        if (this._webhookLock == false) {
            this._webhookLock = true;
            this.log.info(`Processing webhook event '${evt.id}'`);
            if (res !== undefined) {
                const msg = `Webhook event received and currently processing.`;
                // We can't wait for the event to be completed, but at this point its good to run so send 202 ACCEPTED
                res.status(202).send(msg);
            }
            try {
                this.webhookEvents.add(evt);
                await this.webhookEvents.save();
                await this.processWebhookEvent(evt.id);
                this.log.info("Webhook event processed.");
            }
            catch (err) {
                this.log.error(`Error while processing webhook event '${evt.id}'`);
            }
            finally {
                // Clear webhook queue
                this._webhookLock = false;
                if (this._webhookQueue != null) {
                    this.log.info(`Processing next event in queue '${this._webhookQueue.id}'`);
                    const nextEvt = this._webhookQueue;
                    this._webhookQueue = null;
                    this.onWebhookEvent(nextEvt);
                }
            }
        }
        else {
            this.log.warn(`Webhook processor is busy; event added to queue${ this._webhookQueue != null ? `(discarding "${this._webhookQueue.id}")` : ""}.`);
            this._webhookQueue = evt;
            if (res) {
                res.status(202).send(`Webhook event accepted into queue. If another event is received before the current one completes, this one will be discarded in favour of the new event.`);
            }
        }
    }

    private async processWebhookEvent(ref: string): Promise<void> {
        await this.stop();
        try {
            await downloadRemote(this.remoteUrl);
        }
        catch (err) {
            // All other methods do an internal project log except this one, since its outside of the project scope.
            this.log.logException(err);
            throw err;
        }
        await this.install(ref);
        await this.deploy();
    }

    /**
     * Runs the project's installer with the currently available build file.
     * @param eventRef [Optional] The ID of the event that triggered the install workflow.
     */
    public async install(eventRef?: string, cancel?: AbortSignal): Promise<void> {
        this.log.info(`Install process started.`);
        // Stop project and installer if its running.
        await this.stop();
        if (this._installer.running) {
            await this._installer.kill(true);
        }
        try {
            await this._installer.loadConfiguration();
            this.emit("install", this._installer);
            await this._installer.run(eventRef, cancel);
            this.log.info(`Installer finished.`);
        }
        catch (err) {
            const error = new Error(`Installer failed.`, { cause: cancel.aborted ? "Cancelled" : err });
            this.log.logException(error);
            throw error;
        }
    }

    /**
     * Logs an event to both the project's own logfile, and Boop's global one.
     * @param level Directly maps to log level methods, except in the case of `exception` which logs `Error` objects.
     * @param message The main contents of the log event.
     * @param meta Any additional metadata to be saved with the event.
     */
    protected SharedLog(level: "exception", message: Error, ...meta: any[])
    protected SharedLog(level: "info" | "error" | "warn", message: string, ...meta: any[])
    protected SharedLog(level: "info" | "error" | "warn" | "exception", message: string | Error, ...meta: any[]) {
        if (level === "exception" && message instanceof Error) {
            this.log.logException(message);
            logger.error(`'${this.name}': ${message.message}`);
            return;
        }
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
        if (this.installing == true) {
            throw new Error("Project installer is currently running.");
        }
        try {
            await this._deploy();
            this.log.info(`Deployed.`);
        }
        catch (err) {
            this._router = null;
            const error = new Error(`Failed to deploy project.`, { cause: err });
            this.log.logException(error);
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
        if (this.deployed == false) {
            return;
        }
        try {
            await this._stop();
            this.log.info(`Stopped.`);
        }
        catch (err) {
            const error = new Error(`Failed to stop project.`, { cause: err });
            this.log.logException(error);
            throw error;
        }
        finally {
            // Always send stop because a failed stop is likely an invalid state; better safe than sorry.
            this.emit("stop");
            this._router = null;
        }
    }    
    protected abstract _stop(): Promise<void>;

    /**
     * Starts the project. Calls {@link stop} and {@link deploy} in series.
     */
    public async restart(): Promise<void> {
        try {
            await this.stop();
            await this.deploy();
            this.log.info(`Restarted.`);
        }
        catch (err) {
            const error = new Error(`Failed to restart project.`, { cause: err });
            this.log.logException(error);
            throw error;
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (this._disposed) {
            return;
        }
        this._webhookQueue = null;
        await this.installer.kill(true);
        await this.stop();
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