import { join } from "path";
/**
 * Path leading to the `projects` folder, where repositories are downloaded.
 */
export const projectsFolderPath = join(process.cwd(), "/projects");
/**
 * The name of the in-repo configuration file Boop uses to install and run the project.
 */
export const configFileName = "config.yaml";

export const INVALID_WEBHOOK_SIGNATURE = "Unauthorized webhook request, signature invalid.";
export const NOT_A_WEBHOOK = "Invalid.";