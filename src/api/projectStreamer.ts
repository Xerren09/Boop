import WebSocket from "ws"
import { BoopProject } from "../app/projects/project.js";
import { InstallerStep, ProjectInstaller } from "../app/workflow/workers/build.js";

export class ProjectStreamer {
    private _ws: WebSocket;
    private _proj: BoopProject;

    constructor(ws: WebSocket, proj: BoopProject) {
        this._ws = ws;
        this._proj = proj;
        this.wsInit();
    }

    private wsInit() {
        this._proj.on("install", this.onInstallerChange);
        if (this._proj.installer == undefined || this._proj.installing == false) {
            this._ws.send(JSON.stringify({
                ...this._proj.getInstallLog() || {},
                type: "installerHistory"
            }));
        }
        //
        this._ws.send(JSON.stringify({
            type: "deploy",
            deployed: this._proj.deployed,
            exit: this._proj.process?.exitCode || null,
            time: this._proj.lastDeployed,
            output: this._proj.process?.outputSnapshot || []
        }));
        //
        this._proj.on("deploy", this.onProcessDeploy);
    }

    private onInstallerChange = (installer: ProjectInstaller) => {
        installer.once("exit", (success: boolean) => {
            installer.removeListener("step", this.onStepChange);
            this._ws.send(JSON.stringify({
                type: "installerComplete",
                success: installer.complete
            }));
        });
        this._ws.send(JSON.stringify({
            type: "installer",
            steps: [ ...installer.steps.map(el => el.cmd) ]
        }));
        installer.on("step", this.onStepChange);
    }

    private onStepChange = (step: InstallerStep) => {
        step.process?.once("exit", (code) => {
            step.process?.removeListener("output", this.onStepOutput);
            this._ws.send(JSON.stringify({
                type: "stepComplete",
                cmd: step.cmd,
                exit: code
            }));
        });
        step.process?.on("output", this.onStepOutput);
    }

    private onStepOutput = (stream: "stderr" | "stdout", line: string) => {
        this._ws.send(JSON.stringify({
            type: "stepOut",
            cmd: this._proj.installer?.currentStep?.cmd || "",
            output: [
                {
                    stream: stream,
                    line: line
                }
            ]
        }));
    }

    private onProcessDeploy = (status: boolean) => {
        if (this._proj.process) {
            this._ws.send(JSON.stringify({
                type: "deploy",
                deployed: status,
                exit: this._proj.process?.exitCode || null,
                time: this._proj.lastDeployed,
                output: [...this._proj.process.outputSnapshot]
            }));
            //
            if (this._proj.type == "service") {
                if (status) {
                    this._proj.process.on("output", this.onProjectProcessOutput);
                }
                else {
                    this._proj.process!.removeListener("output", this.onProjectProcessOutput);
                }
            }
        }
    }

    private onProjectProcessOutput = (stream: "stderr" | "stdout", line: string) => {
        this._ws.send(JSON.stringify({
            type: "projectOut",
            output: [
                {
                    stream: stream,
                    line: line
                }
            ]
        }));
    }

    public dispose() {
        this._proj.removeListener("install", this.onInstallerChange);
        this._proj.removeListener("deploy", this.onProcessDeploy);
        this._proj.process?.removeListener("output", this.onProjectProcessOutput);
    }
}