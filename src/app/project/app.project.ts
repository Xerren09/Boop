import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { createAppRouter } from "../interfaces/http/app.router.js";
import path from "path";

export class AppProject extends BoopProject {
    private _stopTime: number = -1;
    private _startTime: number = -1;
    public get deployedAt(): number {
        return this._startTime;
    }
    public get stoppedAt(): number {
        return this._stopTime;
    }
    public override get deployed(): boolean {
        return this._router != undefined;
    }

    protected _indexPath: string = "";
    /**
     * The filesystem path pointing to the project's `index.html` file.
     */
    public get indexPath(): string {
        return this._indexPath;
    }

    constructor(config: ProjectConfig){
        super(config);
    }

    protected override async _deploy(): Promise<void> {
        const entryPoint = (await parseWorkflow(await getWorkflowFile(this.binDir))).deploy.entry;
        this._indexPath = path.join(this.binDir, entryPoint);
        this._router = createAppRouter(this.name, this.binDir, entryPoint);
        this._startTime = Date.now();
    }

    protected async _stop(): Promise<void> {
        this._stopTime = Date.now();
    }
}