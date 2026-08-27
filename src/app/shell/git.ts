import { join } from "path";
import { PROJECT_BIN_DIR_NAME, PROJECTS_DIR } from "../constants.js";
import { getProjectNameFromRemote, pathExists } from "../utilities.js";
import { mkdir } from "fs/promises";
import { exec } from "child_process";
import { once } from "events";
import assert from "assert";
import AsyncLock from "async-lock";

const lock = new AsyncLock();

const GIT_BASE_COMMAND = "git -c credential.interactive=false -c core.askPass=true ";

/**
 * Downloads the project's files from the specified remote.
 * 
 * If the files have already been downloaded, performs a `git pull`, otherwise a `git clone`.
 * @param remoteUrl The target repository's url
 * @returns 
 */
export async function downloadRemote(remoteUrl: string, branch?: string | null, cancel?: AbortSignal) {
    await lock.acquire(remoteUrl, async () => { 
        assert(URL.canParse(remoteUrl), `'${remoteUrl}' is not a valid URL.`);
        if (await checkGitRemoteAccess(remoteUrl) === false) {
            throw new Error("Git does not have access to the remote.");
        }
        const name = getProjectNameFromRemote(remoteUrl);
        assert(name, `'${remoteUrl}' is not a valid project URL.`);
        const projectPath = join(PROJECTS_DIR, name);
        const projectBinPath = join(projectPath, PROJECT_BIN_DIR_NAME);
        // Pull by default
        let command: string = `pull '${remoteUrl}' '${branch ?? ""}'`;
        if (await pathExists(projectBinPath) == false) {
            // Clone if files don't exist
            await mkdir(projectBinPath);
            command = `clone --single-branch ${branch ? `--branch '${branch}'` : ""} '${remoteUrl}' .`
        }
        command = `${GIT_BASE_COMMAND}${command}`;
        const proc = exec(command, {
            cwd: projectBinPath,
            signal: cancel
        });
        // This is a shell so shouldn't throw
        const [code, signal] = await once(proc, "exit");
        if (code !== 0) {
            throw new Error(`Failed to sync from remote via '${command}': ${code ?? signal}`, { cause: {code, signal} });
        } 
    });
}

/**
 * Checks if git is installed on the host system.
 * @returns 
 */
export async function checkGitAvailable() {
    const proc = exec(`git --version`);
    const [code, signal] = await once(proc, "exit");
    return code == 0; 
}

/**
 * Checks if a git remote is accessible to the system.
 * @param remote 
 * @returns `true` if git could access the remote, `false` if not.
 */
export async function checkGitRemoteAccess(remote: string) {
    const proc = exec(`${GIT_BASE_COMMAND}ls-remote '${remote}'`, { timeout: 30000 });
    const [code, signal] = await once(proc, "exit");
    return code == 0;
}