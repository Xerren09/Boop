import { join } from "path";
import { PROJECT_BIN_DIR_NAME, PROJECTS_DIR } from "../constants.js";
import { pathExists } from "../utilities.js";
import { mkdir } from "fs/promises";
import { exec } from "child_process";

/**
 * Downloads the project's files from the specified remote.
 * 
 * If the files have already been downloaded, performs a `git pull`, otherwise a `git clone`.
 * @param remoteUrl 
 * @returns 
 */
export function downloadRemote(remoteUrl: string) {
    return new Promise<void>(async (resolve, reject) => {
        const name = remoteUrl.substring(remoteUrl.lastIndexOf('/') + 1);
        const projectPath = join(PROJECTS_DIR, name);
        const projectBinPath = join(projectPath, PROJECT_BIN_DIR_NAME);
        // Pull by default
        let command: string = `git pull ${remoteUrl}`;
        if (await pathExists(projectBinPath) == false) {
            // Clone if files don't exist
            await mkdir(projectBinPath);
            command = `git clone ${remoteUrl} .`
        }
        const proc = exec(command, {
            cwd: projectBinPath
        });
        proc.once("exit", (code) => {
            if (code == 0) {
                resolve();
            }
            else {
                reject(code);
            }
        });
    });   
}

/**
 * Checks if git is installed on the host system.
 * @returns 
 */
export function checkGitAvailable() {
    return new Promise<void>((resolve, reject) => {
        const proc = exec(`git --version`);
        proc.once("exit", (code) => {
            if (code == 0) {
                resolve();
            }
            else {
                reject();
            }
        });
    });
}

