import { join } from "path";
import { resolve__dirname } from "./utilities.js";
import { config } from "dotenv";
config({ quiet: true });

// HACK: this is bad but what can you do.
export const BOOP_BASE_DIR = join(resolve__dirname(import.meta.url), "..");
/**
 * Path to the web control interface's directory.
 */
export const WEB_INTERFACE_DIR = join(BOOP_BASE_DIR, 'bin', 'web');
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
 * The filename of a logged event's main file.
 */
export const PROJECT_LOG_RESULT_FILE_NAME = "result.json";
/**
 * The filename of a service project's main process' STDOUT log file.
 */
export const PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME = "output.log";

//
// ENVIRONMENT VARIABLES
//

export const ENV_PORT_KEY = "PORT";
export const ENV_SECRET_KEY = "SECRET";
export const ENV_DISABLE_WEBHOOK_SECURITY_KEY = "DISABLE_WEBHOOK_SECURITY";
export const DEBUG_ENV_BYPASS_GIT_PULL_KEY = "BYPASS_GIT_PULL";