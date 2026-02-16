import { basename, join } from "path";
import { BOOP_BUILD_FILE_NAME, BOOP_BUILD_FILE_DIR_NAME } from "../constants.js";
import { parse } from "yaml";
import type { ProjectType } from "./project/boop.project.js";
import { readFile } from "fs/promises";
import { pathExists } from "./utilities.js";

/**
 * Reads a project workflow file YAML file and returns it as an object.
 * @param path 
 * @returns 
 */
export async function parseWorkflow(path: string): Promise<WorkflowConfig> {
    const str = (await readFile(path)).toString();
    const config = parse(str) as WorkflowConfig;
    return config;
}

/**
 * Gets the path of the cloned project's workflow file (`./.boop/config.yaml` or `./config.yaml`)
 * 
 * If no file could be found, throws an error.
 * @param projectFilesPath Path to the project's `files` directory.
 * @returns 
 */
export async function getWorkflowFile(projectFilesPath: string) : Promise<string> {
    let path = join(projectFilesPath, BOOP_BUILD_FILE_DIR_NAME, BOOP_BUILD_FILE_NAME);
    // Check ideal path
    if (await pathExists(path) == false) {
        path = join(projectFilesPath, BOOP_BUILD_FILE_NAME);
        // Check fallback path
        if (await pathExists(path) == false) {
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
