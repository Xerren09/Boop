import * as path from "path"
import * as fs from "fs"
import express from 'express';

import { configFileName, projectsFolderPath, projectsSettingsFolderPath } from "../constants"

import { createProxyHost, createWebsiteHost } from './host'
import { checkIfPathExists, pointsToFile } from "../util";

/**Contains the list of currently online projects. */
const projects: Project[] = [];

/**
 * Selects the requested project's host and directs the request to it.
 * @param req 
 * @param res 
 * @param next 
 */
export function projectSelector(req: express.Request, res: express.Response, next: express.NextFunction) {
    const projectName = req.url.split("/")[1];
    const project = getProject(projectName);
    if (project) {
        // Forward to project host
        if (project.router) {
            project.router(req, res, next);
        }
        else {
            next();
        }
    }
    else {
        // Jump to next handler
        next();
    }
}

/**
 * Returns the list of projects hosted by Boop
 * @returns {object[]}
 */
export function listProjects () {
    const list = projects.map(({ router, hostProcess, ...item }) => item);
    return list;
}

/**
 * Adds a new project to the registry
 * @param projectData 
 */
export function updateProjectList(projectData: Project) {
    const projectName = projectData.name;

    const targetPath = path.join(projectData.path, projectData.config?.run || "");
    if (pointsToFile(targetPath)) {
        // File
        projectData.router = createWebsiteHost(projectName, targetPath);
        projects.push();
    }
    else {
        // Command
        projectData.router = createProxyHost(projectName, projectData.port);
    }
    const projectIndex = projects.findIndex(element => element.name == projectName);
    if (projectIndex != -1)
    {
        projects[projectIndex] = projectData;
    }
    else {
        projects.push(projectData);
    }
}

/**
 * Saves the project data into a config file at `directories.projectsSettingsFolderPath`
 * @param {object} project Project instance
 */
export function writeInternalProjectConfig(project: Project) {
    const dataContents = (({ router, hostProcess, ...element }) => element)(project);
    fs.writeFileSync(path.join(projectsSettingsFolderPath, `${project.name}.json`), JSON.stringify(dataContents, null, "\t"));
}

/**
 * Loads in the configuration file from the repository if there is one, otherwise returns `undefined`
 * @param {string} repositoryPath The name of the project (repo name)
 * @returns 
 */
export function getProjectConfig(projectName: string): BoopConfig | undefined {
    const repositoryConfigPath = path.join(projectsFolderPath, projectName, configFileName);
    if (checkIfPathExists(repositoryConfigPath)) {
        const config = JSON.parse(fs.readFileSync(repositoryConfigPath).toString());
        return config;
    }
    return undefined;
}

/**
 * Gets boop's internal configuration file for a given project
 * @param projectName 
 * @returns 
 */
export function getInternalProjectConfig(projectName: string): Project {
    const configPath = path.join(projectsSettingsFolderPath, `${projectName}.json`);
    const config: Project = JSON.parse(fs.readFileSync(configPath).toString()) as Project;
    return config;
}

/**
 * Gets the project instance
 * @param {string} repositoryName Name of the project
 * @returns 
 */
export function getProject(repositoryName: string): Project | undefined {
    const project = projects.find(element => element.name === repositoryName);
    return project;
}
