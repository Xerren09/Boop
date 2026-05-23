import WebSocket from "ws"
import type { BoopProject } from "../../../project/boop.project.js";
import type { InstallerStep, InstallRunner } from "../../../shell/installRunner.js";
import { IDisposable, isNodeAbortException } from "../../../utilities.js";
import { join } from "node:path";
import { PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "../../../../constants.js";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";
import { makeLogDirName } from "../../../../logger.js";

type InstallerStart = {
    type: "installerStart",
    steps: string[],
    time: number,
    eventRef: string | null
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
    time: number,
    killed: boolean
}

type ProcessOutput = {
    type: "processOutput",
    output: string
}

export const InstallStreamerCollection: InstallStreamer[] = [];

export class InstallStreamer implements IDisposable {
    private _ws: WebSocket;
    private _installer: InstallRunner;
    private _disposed: boolean = false;
    private _disposeController: AbortController = new AbortController();

    public get disposed() {
        return this._disposed;
    }

    public readonly project: BoopProject;

    constructor(ws: WebSocket, project: BoopProject) {
        this._ws = ws;
        this.project = project;
        this._installer = project.installer;
        this.wsInit();
        //
        InstallStreamerCollection.push(this);
    }

    private async wsInit() {
        await this.sendHistory();
        this._installer.on("start", this.onInstallerStart);
        this._installer.on("exit", this.onInstallerComplete);
        this._installer.on("step", this.onInstallerStepStart);
        this._installer.on("stepExit", this.onInstallerStepComplete);
        if (this._installer.currentStep != null) {
            // Part of this output was already pushed out by sendHistory(), so start streaming from the open stream
            this._installer.currentStep.process?.output.on("data", this.onProcessOutput);
        }
    }

    /**
     * Synchornises the current installer's status to the client. Will read from logs until the current step/process
     * where it hands it off to the live data stream like if this was a normal run.
     */
    private sendHistory = async () => {
        const installer = this.project.installer;
        const installerTime = installer.startedAt;
        const eventRef = installer.eventTrigger;
        this.onInstallerStart(eventRef);
        for (let index = 0; index < installer.steps.length; index++) {
            const step = installer.steps[index];
            if (step.process == null) {
                break;
            }
            // Send step notification
            this.onInstallerStepStart(step, true);
            const logPath = join(this.project.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, makeLogDirName(installerTime, eventRef), `${index}.log`);
            try {
                await using reader = createReadStream(logPath, { signal: this._disposeController.signal });
                reader.on("data", this.onProcessOutput);
                reader.once("close", () => {
                    reader.removeAllListeners();
                })
                await finished(reader);
            }
            catch (err) {
                if (isNodeAbortException(err instanceof SuppressedError ? err.suppressed : err)) {
                    break;
                }
            }
            finally {
                if (step.process.exited == true) {
                    this.onInstallerStepComplete(step);
                }
            }
        }
        if (installer.running == false) {
            this.onInstallerComplete(installer.success);
        }
    }

    private onInstallerStart = (eventReference: string | null) => {
        const installer = this.project.installer;
        const msg: InstallerStart = {
            type: "installerStart",
            steps: installer.steps.map(el => el.cmd),
            time: installer.startedAt,
            eventRef: eventReference
        };
        this._ws.send(JSON.stringify(msg));
    }

    private onInstallerComplete = (success: boolean) => {
        const msg: InstallerResult = {
            type: "installerResult",
            success: success,
            time: this.project.installer.exitedAt
        };
        this._ws.send(JSON.stringify(msg));
    }

    private onInstallerStepStart = (step: InstallerStep, messageOnly?: boolean) => {
        const msg: ProcessStart = {
            type: "processStart",
            cmd: step.cmd,
            time: step.process?.startTime ?? 0
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        step.process!.output.on("data", this.onProcessOutput);
    }

    private onInstallerStepComplete = (step: InstallerStep) => {
        step.process!.output.removeListener("data", this.onProcessOutput);
        const msg: ProcessExit = {
            type: "processExit",
            exitCode: step.process!.exitCode,
            time: step.process!.exitTime,
            killed: step.process!.wasKilled
        };
        this._ws.send(JSON.stringify(msg));
    }

    private onProcessOutput = (chunk: string | Buffer) => {
        const msg: ProcessOutput = {
            type: "processOutput",
            output: chunk.toString()
        };
        if (this._ws.readyState == WebSocket.OPEN) {
            this._ws.send(JSON.stringify(msg));
        }
    }

    public [Symbol.dispose]() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._disposeController.abort();
        const installer = this._installer;
        installer.removeListener("start", this.onInstallerStart);
        if (installer != undefined) {
            installer.removeListener("exit", this.onInstallerComplete);
            installer.removeListener("step", this.onInstallerStepStart);
            installer.removeListener("stepExit", this.onInstallerStepComplete);
        }
        if (installer.currentStep != null) {
            installer.currentStep.process?.output.removeListener("data", this.onProcessOutput);
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