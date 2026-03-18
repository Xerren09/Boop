import WebSocket from "ws"
import type { BoopProject } from "./boop.project.js";
import type { InstallerStep, InstallRunner } from "../shell/installRunner.js";
import { ServiceProject } from "./service.project.js";
import { IDisposable } from "../utilities.js";

type Deploy = {
    type: "deploy",
    success: boolean,
    time: number
}

type Stop = {
    type: "stop",
    time: number
}

type Installer = {
    type: "installer",
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
    output: {
        stream: "stderr" | "stdout";
        line: string;
    }[]
}

export const ProjectStreamerCollection: ProjectStreamer[] = [];

export class ProjectStreamer implements IDisposable {
    private _ws: WebSocket;
    private _proj: BoopProject;
    private _disposed: boolean = false;

    private currentInstallerStep: InstallerStep | undefined;

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
        ProjectStreamerCollection.push(this);
    }

    private wsInit() {
        // Sync current status
        this.sendHistory();
        //
        this._proj.on("install", this.onInstall);
        this._proj.on("deploy", this.onProjectDeploy);
        this._proj.on("stop", this.onProjectStop);
    }

    private sendHistory = () => {
        // Installer
        const installer = this._proj.installer;
        this.onInstall(installer, true);
        for (let index = 0; index < installer.steps.length; index++) {
            const step = installer.steps[index];
            
            if (step.process.exited == false) {
                break;
            }
            // Send step notification
            this.onInstallerStepChange(step, true);
            // Send full step output
            const stepOutput: ProcessOutput = {
                type: "processOutput",
                output: step.process.output.lines
            };
            this._ws.send(JSON.stringify(stepOutput));
            // Send step complete
            this.onInstallerStepComplete(step, true);
        }
        if (installer.currentStep == null) {
            this.onInstallerComplete(this._proj.installer.success, true);
            //
            this.onProjectDeploy(this._proj.deployed);
            if (this._proj instanceof ServiceProject) {
                const deployOutput: ProcessOutput = {
                    type: "processOutput",
                    output: this._proj.process.output.lines
                };
                this._ws.send(JSON.stringify(deployOutput));
            }
        }
        else {
            // Manually do onInstall's job (-the message)
            installer.once("exit", this.onInstallerComplete);
            installer.on("step", this.onInstallerStepChange);
            installer.on("stepExit", this.onInstallerStepComplete);
            // Notify current step
            this.onInstallerStepChange(this._proj.installer.currentStep);
            // Send step output history up to current point
            const stepOutput: ProcessOutput = {
                type: "processOutput",
                output: this._proj.installer.currentStep.process.output.lines
            };
            this._ws.send(JSON.stringify(stepOutput));
        }
    }

    private onInstall = (installer: InstallRunner, messageOnly?: boolean) => {
        const msg: Installer = {
            type: "installer",
            steps: installer.steps.map(el => el.cmd),
            time:  -1
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
        step.process?.on("output", this.onProcessOutput);
    }

    private onInstallerStepComplete = (step: InstallerStep, messageOnly?: boolean) => {
        step.process?.removeListener("output", this.onProcessOutput);
        const msg: ProcessExit = {
            type: "processExit",
            exitCode: step.process.exitCode,
            time: step.process.exitTime
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        this.currentInstallerStep = undefined;
    }

    private onProcessOutput = (stream: "stderr" | "stdout", line: string) => {
        const msg: ProcessOutput = {
            type: "processOutput",
            output: [
                {
                    stream: stream,
                    line: line
                }
            ]
        };
        this._ws.send(JSON.stringify(msg));
    }

    private onProjectProcessExit = () => {
        if (this._proj instanceof ServiceProject) {
            const message: ProcessExit = {
                type: "processExit",
                exitCode: this._proj.process?.exitCode ?? null,
                time: this._proj.process.exitTime
            }
            this._ws.send(JSON.stringify(message));
        }
    }

    private onProjectDeploy = (success: boolean) => {
        const deployMsg: Deploy = {
            type: "deploy",
            success: success,
            time: this._proj.deployedAt
        }
        this._ws.send(JSON.stringify(deployMsg));
        //
        if (this._proj instanceof ServiceProject) {
            //
            if (success) {
                const message: ProcessStart = {
                    type: "processStart",
                    cmd: this._proj.process.childProcess.spawnargs?.join(" ") ?? "",
                    time: this._proj.process.startTime
                }
                this._ws.send(JSON.stringify(message));
                this._proj.process?.on("output", this.onProcessOutput);
                this._proj.process?.once("exit", this.onProjectProcessExit);
            }
        }
    }

    private onProjectStop = () => {
        const stopMsg: Stop = {
            type: "stop",
            time: this._proj.stoppedAt
        }
        this._ws.send(JSON.stringify(stopMsg));
    }

    public [Symbol.dispose]() {
        if (this._disposed) {
            throw new Error("Project streamer already disposed");
        }
        this._disposed = true;
        this._proj.removeListener("install", this.onInstall);
        this._proj.removeListener("deploy", this.onProjectDeploy);
        this._proj.removeListener("stop", this.onProjectStop);
        const installer = this._proj.installer;
        if (installer != undefined) {
            installer.removeListener("exit", this.onInstallerComplete);
            installer.removeListener("step", this.onInstallerStepChange);
            installer.removeListener("stepExit", this.onInstallerStepComplete);
        }
        if (this.currentInstallerStep != undefined) {
            this.currentInstallerStep.process?.removeListener("output", this.onProcessOutput);
        }
        if (this._proj instanceof ServiceProject) {
            this._proj.process?.removeListener("output", this.onProcessOutput);
            this._proj.process?.removeListener("exit", this.onProjectProcessExit);
        }
        if (this._ws.readyState === this._ws.CONNECTING || this._ws.readyState === this._ws.OPEN) {
            // 1001: resource shutting down
            this._ws.close(1001, "disposed");
        }
    }
}