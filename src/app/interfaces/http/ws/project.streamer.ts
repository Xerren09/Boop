import WebSocket from "ws"
import type { BoopProject } from "../../../project/boop.project.js";
import { ServiceProject } from "../../../project/service.project.js";
import { IAsyncDisposable } from "../../../utilities.js";
import { WebhookEvent } from "../../../webhook.js";
import { join } from "node:path";
import logger, { listProjectLogs } from "../../../../logger.js";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";
import { PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME } from "../../../constants.js";
import { once } from "node:events";

type Deploy = {
    type: "deploy",
    success: boolean,
    time: number
}

type Stop = {
    type: "stop",
    time: number,
    wasKilled: boolean
}

type Install = {
    type: "install",
    time: number,
    ref: string | null
}

type Webhook = {
    type: "webhook",
    event: WebhookEvent
}

type ProcessStart = {
    type: "processStart",
    time: number,
    cmd: string
}

type ProcessExit = {
    type: "processExit",
    exitCode: number | null,
    time: number,
    killed: boolean
}

type ProcessOutput = {
    type: "processOutput",
    output: string
}

export class ProjectStreamer implements IAsyncDisposable {
    private _ws: WebSocket;
    private _withProcess: boolean = false;
    private _disposed: boolean = false;
    private _disposeController: AbortController = new AbortController();

    public get disposed() {
        return this._disposed;
    }

    public readonly project: BoopProject;

    constructor(ws: WebSocket, project: BoopProject, streamMainProcess = false) {
        this._ws = ws;
        this.project = project;
        this.project.on("dispose", this.onShouldDispose);
        this._withProcess = streamMainProcess;
        this.wsInit();
    }

    private async wsInit() {
        await this.sync();
        if (this._disposeController.signal.aborted) {
            return;
        }
        this.project.on("deploy", this.onProjectDeploy);
        this.project.on("webhook", this.onProjectWebhook);
        this.project.on("stop", this.onProjectStop);
        this.project.installer.on("start", this.onProjectInstall);
    }

    private sync = async () => {
        if (this.project.deployed) {
            this.onProjectDeploy(true, true);
        }
        else if (this.project.installing) {
            this.onProjectInstall(this.project.installer.eventTrigger);
        }
        else {
            this.onProjectStop();
        }
        if (this.project.webhookEvents.lastEvent) {
            this.onProjectWebhook(this.project.webhookEvents.lastEvent);
        }
        // Do process catchup
        if (this._withProcess == false) {
            return;
        }
        if (this.project instanceof ServiceProject) {
            if (this.project.process) {
                const message: ProcessStart = {
                    type: "processStart",
                    cmd: this.project.process.childProcess.spawnargs?.join(" ") ?? "",
                    time: this.project.process.startTime
                }
                this._ws.send(JSON.stringify(message));
                //
                try {
                    const logs = await listProjectLogs(this.project, "output");
                    const log = logs.find(el => el.time == this.project.deployedAt);
                    if (!log) {
                        throw new Error("Project process log not found.");
                    }
                    await using reader = createReadStream(join(log.dir, PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME), { signal: this._disposeController.signal });
                    reader.on("data", this.onProcessOutput);
                    reader.once("close", () => {
                        reader.removeAllListeners();
                    })
                    await finished(reader);
                }
                catch (err) {
                    logger.logException(err instanceof SuppressedError ? err.suppressed : err);
                }
                // Leave if disposing
                if (this._disposeController.signal.aborted) {
                    return;
                }
                if (this.project.process.exited) {
                    this.onProjectProcessExit();
                }
                else {
                    this.project.process.output.on("data", this.onProcessOutput);
                    this.project.process.once("exit", this.onProjectProcessExit);
                }
            }
        }
    }

    private onProjectDeploy = (success: boolean, messageOnly: boolean = false) => {
        const deployMsg: Deploy = {
            type: "deploy",
            success: success,
            time: this.project.deployedAt
        }
        this._ws.send(JSON.stringify(deployMsg));
        //
        if (messageOnly) {
            return;
        }
        if (this.project instanceof ServiceProject) {
            if (success && this._withProcess && this.project.process) {
                const message: ProcessStart = {
                    type: "processStart",
                    cmd: this.project.process.childProcess.spawnargs?.join(" ") ?? "",
                    time: this.project.process.startTime
                }
                this._ws.send(JSON.stringify(message));
                this.project.process.output.on("data", this.onProcessOutput);
                this.project.process.once("exit", this.onProjectProcessExit);
            }
        }
    }

    private onProjectStop = () => {
        const stopMsg: Stop = {
            type: "stop",
            time: this.project.stoppedAt,
            wasKilled: this.project instanceof ServiceProject ? ((this.project as ServiceProject).process?.wasKilled ?? false) : true
        }
        this._ws.send(JSON.stringify(stopMsg));
    }

    private onProjectInstall = (eventReference?: string | null) => {
        const installMsg: Install = {
            type: "install",
            time: this.project.installer.startedAt,
            ref: eventReference ?? null
        }
        this._ws.send(JSON.stringify(installMsg));
    }

    private onProjectWebhook = (evt: WebhookEvent) => {
        const installMsg: Webhook = {
            type: "webhook",
            event: evt
        }
        this._ws.send(JSON.stringify(installMsg));
    }

    private onProcessOutput = (chunk: string | Buffer) => {
        const msg: ProcessOutput = {
            type: "processOutput",
            output: chunk.toString()
        };
        this._ws.send(JSON.stringify(msg));
    }

    private onProjectProcessExit = () => {
        if (this.project instanceof ServiceProject) {
            this.project.process!.output.removeListener("data", this.onProcessOutput);
            const message: ProcessExit = {
                type: "processExit",
                exitCode: this.project.process!.exitCode,
                time: this.project.process!.exitTime,
                killed: this.project.process!.wasKilled
            }
            this._ws.send(JSON.stringify(message));
        }
    }

    private onShouldDispose = () => {
        this[Symbol.asyncDispose]();
    };

    public async [Symbol.asyncDispose]() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._disposeController.abort("disposed");
        this.project.removeListener("dispose", this.onShouldDispose);
        this.project.removeListener("deploy", this.onProjectDeploy);
        this.project.installer.removeListener("start", this.onProjectInstall);
        this.project.removeListener("stop", this.onProjectStop);
        this.project.removeListener("webhook", this.onProjectWebhook);
        if (this.project instanceof ServiceProject) {
            this.project.process?.output.removeListener("data", this.onProcessOutput);
            this.project.process?.removeListener("exit", this.onProjectProcessExit);
        }
        if (this._ws.readyState === this._ws.CONNECTING || this._ws.readyState === this._ws.OPEN) {
            // 1001: resource shutting down
            this._ws.close(1001, "PROJECT_DISPOSE");
            await once(this._ws, "close");
        }
    }
}