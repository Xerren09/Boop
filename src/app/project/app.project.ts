import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js"
import { createAppRouter } from "../routers/app.router.js";
import path from "path";

export class AppProject extends BoopProject {
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
    }

    protected async _stop(): Promise<void> {
        return null;
    }
}