import { readFile } from "fs/promises";
import { AppProject } from "./app.project.js";
import { ProjectConfig, BoopProject } from "./boop.project.js";
import { ServiceProject } from "./service.project.js";

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
    await ret.environment.load();
    await ret.events.load();
    return ret;
}
