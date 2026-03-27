import { join } from "path";
import { resolve__dirname } from "./app/utilities.js";

// HACK: this is bad but what can you do.
export const BOOP_BASE_DIR = join(resolve__dirname(import.meta.url), "..");

/**
 * Path leading to the `projects` folder, where repositories are downloaded.
 */
export const PROJECTS_DIR = join(BOOP_BASE_DIR, "/projects");
/**
 * Path to Boop's main log file.
 */
export const LOG_FILE = join(BOOP_BASE_DIR, "/boop.log");
/**
 * The name of the in-repo configuration file Boop uses to install and run the project.
 */
export const BOOP_BUILD_FILE_NAME = "config.yaml";
/**
 * The name of the in-repo directory where the Boop build file is (ideally) located.
 */
export const BOOP_BUILD_FILE_DIR_NAME = ".boop";
/**
 * The filename of a project's main data file.
 */
export const PROJECT_FILE_NAME = "project.json";
/**
 * The filename of a project's ENV file.
 */
export const PROJECT_ENV_FILE_NAME = "env.json";
/**
 * The filename of a project's webhook events log.
 */
export const PROJECT_EVENTS_FILE_NAME = "events.json";
/**
 * The name of a project's repository contents' directory.
 */
export const PROJECT_BIN_DIR_NAME = "files";
/**
 * The name of a project's logs directory.
 */
export const PROJECT_LOGS_DIR_NAME = "logs";
/**
 * The name of a project's install logs directory. Used with {@link PROJECT_LOGS_DIR_NAME}
 */
export const PROJECT_LOGS_INSTALL_DIR_NAME = "install";
/**
 * The name of a project's deploy logs directory. Used with {@link PROJECT_LOGS_DIR_NAME}
 */
export const PROJECT_LOGS_DEPLOY_DIR_NAME = "deploy";
/**
 * The filename of a project's standard event log.
 */
export const PROJECT_LOG_FILE_NAME = "project.log";
/**
 * The maximum number of process output entries to keep as output history.
 */
export const MAX_TERMINAL_HISTORY = 9001;
export const ENV_DISABLE_WEBHOOK_SECURITY = "DISABLE_WEBHOOK_SECURITY";
export const ENV_PORT = "PORT";
export const ENV_SECRET = "SECRET";