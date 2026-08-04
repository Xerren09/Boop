import { join } from "path";
import EventEmitter, { once } from "events";
import { type Response } from "express";
import { WebhookEvent, WebhookEventQueue } from "../webhook.js";
import { DEBUG_ENV_BYPASS_GIT_PULL, PROJECT_BIN_DIR_NAME, PROJECT_ENV_FILE_NAME, PROJECT_EVENTS_FILE_NAME, PROJECT_FILE_NAME, PROJECT_LOGS_DIR_NAME, PROJECTS_DIR } from "../../constants.js";
import { InstallRunner } from "../shell/installRunner.js";
import { EnvFile } from "./env.js";
import { EventsFile } from "./eventLog.js";
import { BoopLogger, createProjectLogger } from "../../logger.js";
import { downloadRemote } from "../shell/git.js";
import { getProjectNameFromRemote, IAsyncDisposable, isDevEnv } from "../utilities.js";
import AsyncLock from "async-lock";

interface BoopProjectEvents {
    'deploy': (success: boolean) => void;
    'stop': () => void;
    'webhook': (webhookEvent: WebhookEvent) => void;
    'dispose': () => void;
}

export interface BoopProject {
    on<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    once<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    emit<EventType extends keyof BoopProjectEvents>(event: EventType, ...args: Parameters<BoopProjectEvents[EventType]>): boolean;
    removeListener<EventType extends keyof BoopProjectEvents>(event: EventType, listener: BoopProjectEvents[EventType]): this;
    removeAllListeners<EventType extends keyof BoopProjectEvents>(event?: EventType): this;
}

export abstract class BoopProject extends EventEmitter implements IAsyncDisposable {
    private lock: AsyncLock = new AsyncLock();
    /**
     * The project's internal configuration (independent from the workflow config)
     */
    private readonly _config: ProjectConfig;
    private readonly _name: string;

    private _webhookQueue: WebhookEventQueue = new WebhookEventQueue();

    protected readonly log: BoopLogger;
    protected _installer: InstallRunner;
    private _disposed: boolean = false;

    protected get webhookEventsFile(): string {
        return join(this.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_EVENTS_FILE_NAME);
    }
    protected get environmentFile(): string {
        return join(this.projectDir, PROJECT_ENV_FILE_NAME);
    }
    protected get projectFile(): string {
        return join(this.projectDir, PROJECT_FILE_NAME);
    }

    get disposed(): boolean {
        return this._disposed;
    }

    /**
     * The root project directory where all the configuration files and project files are stored.
     */
    public get projectDir(): string {
        return join(PROJECTS_DIR, this.name);
    };

    /**
     * The root project files directory where the actual project binaries are stored.
     */
    public get binDir(): string {
        return join(this.projectDir, PROJECT_BIN_DIR_NAME);
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
     * The brancg of the {@link remoteUrl} repository the project is built and accepts event from.
     */
    public get branch(): string {
        return this._config.acceptBranch;
    }

    /**
     * Environment variables set for this project. They will be passed to the launch process during {@link deploy}.
     */
    public readonly environment: EnvFile;

    /**
     * Contains the list of recent WebhookEvents this project received.
     */
    public readonly webhookEvents: EventsFile;

    public abstract get deployedAt(): number;
    public abstract get stoppedAt(): number;
    
    constructor(config: ProjectConfig) {
        super();
        // @ts-expect-error By this point the URL is verified to be valid
        this._name = getProjectNameFromRemote(config.repositoryURL);
        this._config = config;
        this.environment = new EnvFile(this.environmentFile);
        this.webhookEvents = new EventsFile(this.webhookEventsFile);
        //
        this._installer = new InstallRunner(this.binDir);
        //
        this.log = createProjectLogger(this.projectDir);
    }

    /**
     * Handles an incoming Webhook event.
     * 
     * WARN: this is designed to consume errors and will not throw.
     * @param evt The event that triggered the handler.
     * @param res Optional `express.Response` event used to provide immediate configuration response (like if the branch is correct). Does not actually wait for completion of the handler.
     */
    public onWebhookEvent(evt: WebhookEvent) {
        this.log.info(`Webhook event queued.`, { event: evt.id });
        this._webhookQueue.push(evt, (cancel) => {
            this.webhookEvents.add(evt);
            this.emit("webhook", evt);
            return this.processWebhookEvent(evt.id, cancel);
        });
    }

    private async processWebhookEvent(ref: string, cancel: AbortSignal): Promise<void> {
        await this.lock.acquire(["webhook", ref], async () => {
            this.log.info(`Processing webhook event.`, { event: ref });
            await this.webhookEvents.save();
            await this.stop(ref);
            await this.pull(ref, cancel);
            await this.install(ref, cancel);
            // Deploy should be near instanteous since we're running things in a shell, but check cancel first
            cancel.throwIfAborted();
            await this.deploy(ref);
            this.log.info("Webhook event processed.", { event: ref });
        });   
    }

    /**
     * Pulls the latest version from the project's remote.
     * @param eventReference [Optional] The ID of the event that triggered the event.
     * @param cancel 
     */
    public async pull(eventReference?: string, cancel?: AbortSignal): Promise<void> {
        this.throwIfDisposed();
        this.throwIfNotInWebhookContext(eventReference);
        await this.lock.acquire("pull", async () => { 
            try {
                if (DEBUG_ENV_BYPASS_GIT_PULL == false) {
                    await downloadRemote(this.remoteUrl, this._config.acceptBranch, cancel);
                }
                this.log.info(`Remote cloned.`, { event: eventReference });
            }
            catch (err) {
                const error = new Error(`Git pull failed.`, { cause: err });
                this.log.logException(error);
                throw error;
            }
        });
    }

    /**
     * Runs the project's installer with the currently available build file.
     * @param eventReference [Optional] The ID of the event that triggered the event.
     * @param cancel 
     */
    public async install(eventReference?: string, cancel?: AbortSignal): Promise<void> {
        this.throwIfDisposed();
        this.throwIfNotInWebhookContext(eventReference);
        await this.lock.acquire("install", async () => {
            this.log.info(`Install process started.`, { event: eventReference });
            // Stop project and installer if its running.
            await this.stop(eventReference);
            if (this._installer.running) {
                await this._installer.kill(true);
            }
            try {
                await this._installer.loadConfiguration();
                await this._installer.run(eventReference, cancel);
                this.log.info(`Installer finished.`, { event: eventReference });
            }
            catch (err) {
                this.log.logException(err);
                throw err;
            }
        });
    }

    /**
     * Deploys the project so it is available through Boop's proxies.
     * @param eventReference [Optional] The ID of the event that triggered the event.
     * @returns 
     */
    public async deploy(eventReference?: string): Promise<void> {
        this.throwIfDisposed();
        this.throwIfNotInWebhookContext(eventReference);
        await this.lock.acquire("deploy", async () => {
            if (this.deployed) {
                return;
            }
            if (this.installing == true) {
                throw new Error("Project installer is currently running.");
            }
            try {
                await this._deploy(eventReference);
                this.log.info(`Deployed.`, { event: eventReference });
            }
            catch (err) {
                const error = new Error(`Failed to deploy project.`, { cause: err });
                this.log.logException(error);
                throw error;
            }
            finally {
                this.emit("deploy", this.deployed);
            }
        });
    }
    protected abstract _deploy(eventReference?: string): Promise<void>;
    
    /**
     * Stops the project's handler, making it unavailable through Boop's proxies.
     * @param eventReference [Optional] The ID of the event that triggered the event.
     */
    public async stop(eventReference?: string): Promise<void> {
        // Deliberately don't throw if disposed or not in the right webhook context.
        // Stop is a logically safe action in every situation, as it won't do anything on a disposed instance
        // if there were no leftovers, otherwise it'd solve a problem. It's also used during disposal, so it
        // needs to be allowed to run. During webhook locks it also has minimal impact.
        await this.lock.acquire("stop", async () => { 
            try {
                if (this.deployed) {
                    await this._stop();
                    this.log.info(`Stopped.`, { event: eventReference });
                }
            }
            catch (err) {
                const error = new Error(`Failed to stop project.`, { cause: err });
                this.log.logException(error);
                throw error;
            }
            finally {
                // Always send stop because a failed stop is likely an invalid state; better safe than sorry.
                this.emit("stop");
            }
        });
    }    
    protected abstract _stop(): Promise<void>;

    /**
     * Restarts the project. Calls {@link stop} and {@link deploy} in series.
     */
    public async restart(): Promise<void> {
        this.throwIfDisposed();
        this.throwIfNotInWebhookContext();
        await this.lock.acquire("restart", async () => {
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
        });
    }

    protected throwIfDisposed() {
        if (this._disposed) {
            throw new Error("Project instance disposed.");
        }
    }

    /**
     * Throws if the `webhook` key is locked, and if the provided {@link contextKey} is not the same as used by the current webhook lock.
     * 
     * Methods are allowed to be called during a `webhook` lock, but ***only*** if their context (event reference ID) is the same; hence the "context" of the lock.
     * 
     * If the context key is different or empty, throws to prevent the methods from running and potentially faulting the webhook execution.
     * 
     * @param contextKey The `eventReference` value used by the current `webhook` lock as the secondary key.
     */
    protected throwIfNotInWebhookContext(contextKey?: string | string[]) {
        const isWebhookActive = this.lock.isBusy("webhook");
        if (!contextKey && isWebhookActive) {
            throw new Error("Project instance busy.");
        }
        if (Array.isArray(contextKey)) {
            const locked = contextKey.every(k => this.lock.isBusy(k) == true);
            if (locked == false && isWebhookActive) {
                throw new Error("Project instance busy.");
            }
        }
        else if (isWebhookActive && this.lock.isBusy(contextKey) == false) {
            throw new Error("Project instance busy.");
        }
    }

    protected throwIfLocked(key?: string | string[]) {
        if (Array.isArray(key)) {
            const locked = key.findIndex(k => this.lock.isBusy(k) == true);
            if (locked != -1) {
                throw new Error("Project instance busy.");
            }
        }
        else if (this.lock.isBusy(key)) {
            throw new Error("Project instance busy.");
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        const res = await Promise.allSettled([
            this._webhookQueue.cancelAll(),
            this.installer.kill(true),
            this.stop(),
            this.environment.save()
        ]);
        const errs: any[] = res.filter(el => el.status == "rejected").map(el => el.reason);
        try {
            this.log.end();
            await once(this.log, "finish");
            this.emit("dispose");
        }
        catch (e) {
            errs.push(e);
        }
        if (errs.length != 0) {
            throw new AggregateError(errs, "One or more exceptions occured during disposal.")
        }
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