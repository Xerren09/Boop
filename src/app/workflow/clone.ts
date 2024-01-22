import { join } from "path";
import { projectsFolderPath } from "../constants.js";
import { existsSync, mkdirSync } from "fs";
import { shellExecuteAsync } from "./shell.js";

/**
 * Downloads the project's files from the specified remote.
 * 
 * If the files have already been downloaded, performs a `git pull`, otherwise a `git clone`.
 * @param projectName 
 * @param remoteUrl 
 * @returns 
 */
export function downloadRemote(projectName: string, remoteUrl: string) {
    return new Promise<void>((resolve, reject) => {
        const projectPath = join(projectsFolderPath, projectName);
        const projectFilesRootPath = join(projectPath, "files");
        // Pull by default
        let command: string = `git pull ${remoteUrl}`;
        if (existsSync(projectFilesRootPath) == false) {
            // Clone if files don't exist
            mkdirSync(projectFilesRootPath);
            command = `git clone ${remoteUrl} .`
        }
        const result = shellExecuteAsync(command, projectFilesRootPath);
        result.once("exit", (code) => {
            if (code == 0) {
                resolve();
            }
            else {
                reject(result);
            }
        });
    });
    
}