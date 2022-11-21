import * as shell from "shelljs"
shell.config.silent = true;
import * as fs from "fs";
import { projectsFolderPath } from '../constants'
import path from "path";

/**
 * Synchronously executes an array of commands
 * @param {string[]} commands List of commands to run
 * @param {string} cwd Working directory for the commands
 * @returns 
 */
export async function executeCommands(commands: string[], cwd: string): Promise<ExecResult[]> {
    let flow: ExecResult[] = [];
    // Run through each command, execute synchronously, and then log the results.
    for (let command of commands) {
        const cmd = shell.exec(command, { cwd: cwd, silent: true });
        let commandFlow: ExecResult = {
            command: command,
            output: cmd.stdout.toString().split(`\n`).filter(elem => elem != ""),
            error: cmd.stderr.toString().split(`\n`).filter(elem => elem != ""),
            exitCode: cmd.code
        };
        flow.push(commandFlow);
        // Aborts on fail.
        if (commandFlow.exitCode != 0) {
            break;
        }
    }
    return flow;
}

/**
 * Clones or pulls a repository into `./projects/<repo_name>`
 * @param {string} gitHubURL GitHub url of the repository
 * @param {string} clonePath Name of the repository (from webhook event)
 * @returns 
 */
export async function cloneGithubRepository(gitHubURL: string) {
    let command = `git clone ${gitHubURL}`;
    // Delete repo
    const gitSegments = gitHubURL.split('/');
    const repoName = gitSegments[gitSegments.length - 1];
    const rmPath = path.join(projectsFolderPath, repoName);
    fs.rmSync(rmPath, { recursive: true, force: true }); 
    // Clone repo
    let result = await executeCommands([command], projectsFolderPath);
    return result[0];
}