import * as fs from "fs";
import * as path from "path"
import kill from "tree-kill"

import { projectsFolderPath, projectsSettingsFolderPath } from '../constants'
import { getFreePort } from '../projects/host'
import { updateProjectList, getProject, writeInternalProjectConfig } from '../projects'
import { fork } from "child_process";
import { pointsToFile } from "../util";

/**
 * Runs the full install process.
 * @param webhookEvent 
 */
export async function installProject(webhookEvent: WebhookEvent) {
    const localRepositoryPath = path.join(projectsFolderPath, webhookEvent.repository.name);
    const internalConfigPath = path.join(projectsSettingsFolderPath, `${webhookEvent.repository.name}.json`);

    const projectConfig: Project = {
        path: localRepositoryPath,
        name: webhookEvent.repository.name,
        route: `/${webhookEvent.repository.name}/`,
        port: -1,
        repositoryURL: webhookEvent.repository.url,
        lastEvent: webhookEvent,
        isInstalling: true,
    };

    stopHostProcess(webhookEvent.repository.name, () => {
        fs.writeFileSync(internalConfigPath, JSON.stringify(projectConfig, null, "\t"));

        const projectInstaller = fork('./lib/install/ProjectInstaller', [webhookEvent.repository.name], { cwd: process.cwd(), silent: true });

        projectInstaller.on("close", function (code) {
            console.log(`Install worker for ${webhookEvent.repository.name} finished.`);
            // Start host
            startProject(JSON.parse(fs.readFileSync(internalConfigPath).toString()));
        }); 
    });
}

/**
 * Starts the given project and creates their host.
 * @param project 
 */
export async function startProject(project: Project) {
    const targetPath = path.join(project.path, project.config?.run || "");
    if (pointsToFile(targetPath)) {
        // File
        updateProjectList(project);
    }
    else {
        // Command
        getFreePort((port) => {
            project.port = port;

            project.hostProcess = fork('./lib/install/ProjectWorker', [project.name, port.toString()], { cwd: process.cwd(), silent: true });
            
            updateProjectList(project);
        });
    }
}

/**
 * Stops the given project's host process, if any.
 * @param projectName 
 */
export function stopHostProcess(projectName: string, callback: ()=>void) {
    const project = getProject(projectName);
    if (project && project.hostProcess) {
        if (project.hostProcess.pid) {
            kill(project.hostProcess.pid, () => {
                callback();
            });
        }
    }
    else {
        callback();
    }
}