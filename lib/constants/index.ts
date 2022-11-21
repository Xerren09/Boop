import * as path from "path"
/**
 * Path leading to the `projects` folder, where repositories are downloaded.
 */
export const projectsFolderPath = path.join(process.cwd(), "/projects");
/**
 * Path leading to the `data` folder, where app configurations are stored.
 */
export const projectsSettingsFolderPath = path.join(process.cwd(), "/data");
/**
 * The name of the in-repo configuration file Boop uses to install and run the project.
 */
export const configFileName = "boop.config.json";