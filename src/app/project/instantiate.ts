import { readFile } from "fs/promises";
import { AppProject } from "./app.project.js";
import { ProjectConfig, BoopProject } from "./boop.project.js";
import { ServiceProject } from "./service.project.js";
import { pathExists } from "../utilities.js";
import { join } from "path";
import { PROJECT_ENV_FILE_NAME, PROJECT_EVENTS_FILE_NAME, PROJECT_LOGS_DIR_NAME } from "../../constants.js";

/**
 * Creates and initialises a new {@link BoopProject}.
 * @param config Can be either a {@link ProjectConfig} object or a `string` filepath of a project file.
 * @returns 
 */
export async function InstantiateProject(config: ProjectConfig | string): Promise<BoopProject> {
    let projectConfig: ProjectConfig = null;
    if (typeof config === "string") {
        projectConfig = JSON.parse((await readFile(config)).toString()) as ProjectConfig;
    }
    else {
        projectConfig = config;
    }
    let ret: BoopProject = null;
    switch (projectConfig.type) {
        case "webapp":
            ret = new AppProject(projectConfig);
            break;
        case "service":
            ret = new ServiceProject(projectConfig);
            break;
    }
    if (await pathExists(join(ret.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_EVENTS_FILE_NAME))) {
        await ret.webhookEvents.load();
    }
    else {
        await ret.webhookEvents.save();
    }
    if (await pathExists(join(ret.projectDir, PROJECT_ENV_FILE_NAME))) {
        await ret.environment.load();
    }
    else {
        await ret.environment.save();
    }
    return ret;
}
