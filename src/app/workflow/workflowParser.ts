import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import { configFileName } from "../constants.js";
import { ProjectType } from "../projects/project.js";
import { parse } from "yaml";

export function parseWorkflow(path: string) : WorkflowConfig {
    const config = parse(readFileSync(path).toString()) as WorkflowConfig;
//    const config = JSON.parse(readFileSync(path).toString()) as WorkflowConfig;
    return config;
}

/**
 * Gets the path of the cloned project's workflow file (`./.boop/config.yaml` or `./config.yaml`)
 * 
 * If no file could be found, throws an error.
 * @param projectFilesPath Path to the project's `files` directory.
 * @returns 
 */
export function getWorkflowPath(projectFilesPath: string) : string {
    let path = join(projectFilesPath, ".boop", configFileName);
    // Check ideal path
    if (existsSync(path) == false) {
        path = join(projectFilesPath, configFileName);
        // Check fallback path
        if (existsSync(path) == false) {
            throw new Error(`No build config file could be found for project ${basename(projectFilesPath)}.`);
        }
    }
    return path;
}

export interface WorkflowConfig {
    /**
     * The type of the project.
     * 
     * `service` is used for server applications.
     * 
     * `webapp` is used for browser applications / webpages.
     */
    type: ProjectType;
    /**
     * The git branch we're interested in.
     */
    branch: string;
    /**
     * The list of build commands before the project can be hosted.
     */
    build: string[];
    /**
     * Contains deployment instructions.
     */
    deploy: {
        /**
         * Contains default Environment Variables.
         */
        env?: {
            [key: string]:  string | number
        },
        /**
         * Entry point for the project. Can be a path for static websites, or a command for apps.
         */
        entry: string;
    }
}

interface __WorkflowConfig {
    /**
     * The type of the project.
     * 
     * `service` is used for server applications.
     * 
     * `webapp` is used for browser applications / webpages.
     */
    type: ProjectType;
    /**
     * The git branch we're interested in.
     */
    branch: string;
    /**
     * The list of build commands before the project can be hosted.
     */
    build: string[];
    /**
     * The project root that is hosted. Can be a path for static websites, or a command for apps.
     */
    start: string;
}
