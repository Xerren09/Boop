import { downloadRemote } from "../shell/clone.js";
import { getWorkflowFile, parseWorkflow } from "../workflow.js";
import { BoopProject, type ProjectConfig } from "./index.js"
import { createAppRouter } from "../routers/app.router.js";

export class AppProject extends BoopProject {
    public override get deployed(): boolean {
        return this._router != undefined;
    }

    constructor(config: ProjectConfig){
        super(config);
    }

    protected override async _deploy(): Promise<void> {
        const entryPoint = (await parseWorkflow(await getWorkflowFile(this.binDir))).deploy.entry;
        this._router = createAppRouter(this.name, this.binDir, entryPoint);
    }

    protected async _stop(): Promise<void> {
        return null;
    }
}