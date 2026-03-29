import WebSocket from "ws"
import type { BoopProject } from "./boop.project.js";
import type { InstallerStep, InstallRunner } from "../shell/installRunner.js";
import { IDisposable } from "../utilities.js";
import { join } from "node:path";
import { PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "../../constants.ts";
import { open } from "node:fs/promises";
import { once } from "node:events";

type InstallerStart = {
    type: "installerStart",
    steps: string[],
    time: number
}

type InstallerResult = {
    type: "installerResult",
    success: boolean,
    time: number
}

type ProcessStart = {
    type: "processStart",
    time: number,
    cmd: string
}

type ProcessExit = {
    type: "processExit",
    exitCode: number | null,
    time: number
}

type ProcessOutput = {
    type: "processOutput",
    output: string
}

export const InstallStreamerCollection: InstallStreamer[] = [];

export class InstallStreamer implements IDisposable {
    private _ws: WebSocket;
    private _proj: BoopProject;
    private _disposed: boolean = false;

    private currentInstallerStep: InstallerStep | null;

    public get disposed() {
        return this._disposed;
    }

    public get project() {
        return this._proj;
    }

    constructor(ws: WebSocket, proj: BoopProject) {
        this._ws = ws;
        this._proj = proj;
        this.wsInit();
        //
        InstallStreamerCollection.push(this);
    }

    private async wsInit() {
        // Sync current status
        await this.sendHistory();
        //
        this._proj.on("install", this.onInstall);
    }

    private sendHistory = async () => {
        // Installer
        const installer = this._proj.installer;
        const installerTime = installer.startedAt;
        const installerRef = installer.eventTrigger;
        this.onInstall(installer, true);
        for (let index = 0; index < installer.steps.length; index++) {
            const step = installer.steps[index];
            if (step.process == null) {
                break;
            }
            // Send step notification
            this.onInstallerStepChange(step, true);
            const logPath = join(this._proj.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, `${installerTime}-${installerRef}`, `${index}.log`);
            await using handle = await open(logPath);
            await using reader = handle.createReadStream();
            const handler = (data: string | Buffer) => {
                const stepOutput: ProcessOutput = {
                    type: "processOutput",
                    output: data.toString()
                };
                this._ws.send(JSON.stringify(stepOutput));
            }
            reader.on("data", handler);
            await once(reader, "close");
            reader.removeListener("data", handler);
            if (step.process.exited == true) {
                this.onInstallerStepComplete(step, true);
            }
        }
        if (installer.running == false) {
            this.onInstallerComplete(this._proj.installer.success, true);
        }
        else {
            // Manually do onInstall's job (-the message)
            installer.once("exit", this.onInstallerComplete);
            installer.on("step", this.onInstallerStepChange);
            installer.on("stepExit", this.onInstallerStepComplete);
            if (installer.currentStep != null) {
                // Part of this output was already pushed out by the for loop, so start streaming from the open stream
                installer.currentStep.process.output.on("data", this.onProcessOutput);
            }
        }
    }

    private onInstall = (installer: InstallRunner, messageOnly?: boolean) => {
        const msg: InstallerStart = {
            type: "installerStart",
            steps: installer.steps.map(el => el.cmd),
            time:  installer.startedAt
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        installer.once("exit", this.onInstallerComplete);
        installer.on("step", this.onInstallerStepChange);
        installer.on("stepExit", this.onInstallerStepComplete);
    }

    private onInstallerComplete = (success: boolean, messageOnly?: boolean) => {
        const msg: InstallerResult = {
            type: "installerResult",
            success: success,
            time: this._proj.installer.exitedAt
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        this._proj.installer.removeListener("step", this.onInstallerStepChange);
        this._proj.installer.removeListener("stepExit", this.onInstallerStepComplete);
    }

    private onInstallerStepChange = (step: InstallerStep, messageOnly?: boolean) => {
        const msg: ProcessStart = {
            type: "processStart",
            cmd: step.cmd,
            time: step.process.startTime
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        this.currentInstallerStep = step;
        step.process.output.on("data", this.onProcessOutput);
    }

    private onInstallerStepComplete = (step: InstallerStep, messageOnly?: boolean) => {
        step.process.output.removeListener("data", this.onProcessOutput);
        const msg: ProcessExit = {
            type: "processExit",
            exitCode: step.process.exitCode,
            time: step.process.exitTime
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        this.currentInstallerStep = null;
    }

    private onProcessOutput = (chunk: string | Buffer) => {
        const msg: ProcessOutput = {
            type: "processOutput",
            output: chunk.toString()
        };
        this._ws.send(JSON.stringify(msg));
    }

    public [Symbol.dispose]() {
        if (this._disposed) {
            throw new Error("Install streamer already disposed");
        }
        this._disposed = true;
        this._proj.removeListener("install", this.onInstall);
        const installer = this._proj.installer;
        if (installer != undefined) {
            installer.removeListener("exit", this.onInstallerComplete);
            installer.removeListener("step", this.onInstallerStepChange);
            installer.removeListener("stepExit", this.onInstallerStepComplete);
        }
        if (this.currentInstallerStep != null) {
            this.currentInstallerStep.process?.output.removeListener("data", this.onProcessOutput);
        }
        if (this._ws.readyState === this._ws.CONNECTING || this._ws.readyState === this._ws.OPEN) {
            // 1001: resource shutting down
            this._ws.close(1001, "disposed");
        }
        //
        const idx = InstallStreamerCollection.indexOf(this);
        InstallStreamerCollection.splice(idx, 1);
    }
}