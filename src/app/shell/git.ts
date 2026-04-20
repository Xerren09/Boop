import { join } from "path";
import { PROJECT_BIN_DIR_NAME, PROJECTS_DIR } from "../../constants.js";
import { getProjectNameFromRemote, pathExists } from "../utilities.js";
import { mkdir } from "fs/promises";
import { exec } from "child_process";
import { once } from "events";
import assert from "assert";

/**
 * Downloads the project's files from the specified remote.
 * 
 * If the files have already been downloaded, performs a `git pull`, otherwise a `git clone`.
 * @param remoteUrl 
 * @returns 
 */
export async function downloadRemote(remoteUrl: string, cancel?: AbortSignal) {
    assert(URL.canParse(remoteUrl), `'${remoteUrl}' is not a valid URL.`)
    const name = getProjectNameFromRemote(remoteUrl);
    assert(name, `'${remoteUrl}' is not a valid project URL.`);
    const projectPath = join(PROJECTS_DIR, name);
    const projectBinPath = join(projectPath, PROJECT_BIN_DIR_NAME);
    // Pull by default
    let command: string = `git pull "${remoteUrl}"`;
    if (await pathExists(projectBinPath) == false) {
        // Clone if files don't exist
        await mkdir(projectBinPath);
        command = `git clone "${remoteUrl}" .`
    }
    const proc = exec(command, {
        cwd: projectBinPath,
        signal: cancel
    });
    // This is a shell so shouldn't throw
    const [code, signal] = await once(proc, "exit");
    if (code !== 0) {
        throw new Error(`Failed to sync from remote via '${command}': ${code ?? signal}`, { cause: {code, signal} });
    }   
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

