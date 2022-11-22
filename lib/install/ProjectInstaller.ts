import * as fs from "fs";
import * as path from "path"

import { cloneGithubRepository, executeCommands } from './shell'
import { projectsFolderPath, projectsSettingsFolderPath } from '../constants'
import { getProjectConfig } from '../projects'

async function start() {
    console.log(`Build process started for project ${process.argv[2]}.`);
    
    const configPath = path.join(projectsSettingsFolderPath, `${process.argv[2]}.json`);
    const config: Project = JSON.parse(fs.readFileSync(configPath).toString()) as Project;
    const webhookEvent: WebhookEvent = config.lastEvent;
    config.flow = await installProject(webhookEvent);
    config.isInstalling = false;
    config.config = getProjectConfig(webhookEvent.repository.name);
    // Save internal config
    fs.writeFileSync(configPath, JSON.stringify(config, null, "\t"));
    console.log(`${process.argv[2]} configuration updated.`);
}


async function installProject(webhookEvent: WebhookEvent) {
    const localRepositoryPath = path.join(projectsFolderPath, webhookEvent.repository.name);
    let flow: FlowSteps = {
        startTime: Date.now()
    };
    // Clone repo
    flow.clone = await clone(webhookEvent.repository.url);
    // If the repo was cloned successfully, build it
    if (flow.clone.exitCode == 0) {
        const config = getProjectConfig(webhookEvent.repository.name);
        if (config) {
            //console.log(`Project configuration found.`);
            //console.log(JSON.stringify(config, null, "\t"));
            flow.build = await build(config.build, localRepositoryPath);
        }
        else {
            //console.warn(`Project configuration file missing. Removing files.`);
            fs.rmSync(localRepositoryPath, { recursive: true, force: true });
        }
    }
    return flow;
}

async function clone(url: string) {
    //console.log(`Cloning repository from ${url}.`);
    
    return await cloneGithubRepository(url);
}

async function build(buildCommands: string[], path: string) {
    //console.log(`Building app at ${path}.`);
    
    return await executeCommands(buildCommands, path);
}

start();