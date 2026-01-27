import WebSocket from "ws"
import type { BoopProject } from "./boop.project.js";
import type { InstallerStep, InstallRunner } from "../shell/installRunner.js";
import { ServiceProject } from "./service.project.js";

type Deploy = {
    type: "deploy",
    time: number,
    cmd: string
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

type InstallerStepStart = {
    type: "installerStep",
    cmd: string,
    time: number
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

export class ProjectStreamer {
    private _ws: WebSocket;
    private _proj: BoopProject;

    private currentInstallerStep: InstallerStep | undefined;

    public get project() {
        return this._proj;
    }

    constructor(ws: WebSocket, proj: BoopProject) {
        this._ws = ws;
        this._proj = proj;
        this.wsInit();
    }

    private wsInit() {
        // Sync current status
        this.sendHistory();
        //
        this._proj.on("install", this.onInstall);
        this._proj.on("deploy", this.onProjectDeploy);
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
                output: step.process.Output.output
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
                    output: this._proj.process.Output.output
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
                output: this._proj.installer.currentStep.process.Output.output
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
        const msg: InstallerStepStart = {
            type: "installerStep",
            cmd: step.cmd,
            time: step.process.startTime
        };
        this._ws.send(JSON.stringify(msg));
        if (messageOnly) {
            return;
        }
        this.currentInstallerStep = step;
        step.process?.on("output", this.onProcessOutput);
        step.process?.once("exit", (_code) => {
            step.process?.removeListener("output", this.onProcessOutput);
        });
    }

    private onInstallerStepComplete = (step: InstallerStep, messageOnly?: boolean) => {
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

    private onProjectDeploy = (success: boolean) => {
        if (this._proj instanceof ServiceProject) {
            //
            if (success) {
                const message: Deploy = {
                    type: "deploy",
                    cmd: this._proj.process.childProcess.spawnargs.join(" "),
                    time: this._proj.process.startTime
                }
                this._ws.send(JSON.stringify(message));
                this._proj.process?.on("output", this.onProcessOutput);
            }
            else {
                this._proj.process?.removeListener("output", this.onProcessOutput);
                const second: ProcessExit = {
                    type: "processExit",
                    exitCode: this._proj.process?.exitCode ?? null,
                    time: this._proj.process.exitTime
                }
                this._ws.send(JSON.stringify(second));
            }
        }
        else {
            const message: Deploy = {
                type: "deploy",
                cmd: "",
                time: 0
            }
            this._ws.send(JSON.stringify(message));
        }
    }

    public dispose() {
        this._proj.removeListener("install", this.onInstall);
        this._proj.removeListener("deploy", this.onProjectDeploy);
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
        }
    }
}