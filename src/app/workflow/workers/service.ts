import { BoopProcess, shellExecuteAsync } from "../shell.js";
import { getWorkflowPath, parseWorkflow } from "../workflowParser.js";

var dir = process.argv[2] as string;
var env = JSON.parse(process.argv[3]);
var proc: BoopProcess;

function startService() {
    const config = parseWorkflow(getWorkflowPath(dir));
    const entry = config.deploy.entry;
    proc = shellExecuteAsync(entry, dir, env, false);
    proc.once("exit", (code) => {
        if (code != null) {
            process.exit(code);
        }
    }); 
}

startService();

process.once("exit", () => {
    if (proc != undefined) {
        proc.kill();
    }
});