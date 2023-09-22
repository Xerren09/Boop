import * as fs from "fs"
import * as path from "path"
import { checkIfPathExists } from "./util";
import { projectsFolderPath, projectsSettingsFolderPath } from "./constants";
import { startProject } from "./install/flow";
import { projects } from "./projects/index";
import kill from "tree-kill";

export function startBoop() {
    if (checkIfPathExists(projectsSettingsFolderPath) == false) {
        fs.mkdirSync(projectsSettingsFolderPath);
    }
    if (checkIfPathExists(projectsFolderPath) == false) {
        fs.mkdirSync(projectsFolderPath);
    }
    process.on('close', (code) => {
        projects.forEach(element => {
            if (element.hostProcess != null) {
                if (element.hostProcess.pid) {
                    kill(element.hostProcess.pid);
                }
            }
        });
    });
    restartHosts();
}

/**
 * Starts all hosts from their internal configuration files.
 */
function restartHosts() {
    fs.readdirSync(projectsSettingsFolderPath).forEach(element => {
        const project = JSON.parse(fs.readFileSync(path.join(projectsSettingsFolderPath, element)).toString()) as Project;
        // Check if the repo exists
        if (checkIfPathExists(project.path)) {
            startProject(project);
            console.log(`${project.name} started.`);
        }
    });
}