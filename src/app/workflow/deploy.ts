import { ChildProcess, fork } from "child_process";
import { BoopProcess } from "./shell.js";
import { join } from "path";
import { __dirname } from "../../utils.js";

export function deployService(projectRootPath: string, env: object = {}): BoopProcess {
    let proc: ChildProcess = fork(join(__dirname(import.meta.url), 'workers/service'), [projectRootPath, JSON.stringify(env)], { cwd: process.cwd(), silent: true });
    return new BoopProcess(proc);
}