import winston from "winston";
import { LOG_FILE, PROJECT_LOG_FILE_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "./constants.js";
import { join } from "path";
import { readdir } from "fs/promises";
import { BoopProject } from "./project/boop.project.js";
import { BoopConfiguration } from "./settings.js";
import { serializeError } from "serialize-error";
export interface BoopLogger extends winston.Logger {
    /**
     * Logs an {@link Error} object with its `cause` property. Handles nested errors.
     * @param exception The `Error` instance or other thrown value to log. 
     * @param message Optional error message. If not given, {@link Error.message} will be used.
     * @returns 
     */
    logException: (exception: any, message?: string) => void
}

function createLogger(path: string, level?: string | null, disableConsole?: boolean, consoleLevel?: string | null) {
    const instance = winston.createLogger({
        transports: [
            new winston.transports.File({
                filename: path,
                format: winston.format.combine(
                    winston.format.uncolorize(),
                    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                    winston.format.metadata(),
                    winston.format.errors(),
                    winston.format.json()
                ),
                level: level ?? "silly"
            })
        ],
    });
    if (disableConsole !== true) {
        instance.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
            level: consoleLevel ?? "warn"
        }));
    }
    instance["logException"] = logException;
    return instance as BoopLogger;
}

const logger = createLogger(LOG_FILE, null, BoopConfiguration.DEBUG == false);
export default logger as BoopLogger;

export function createProjectLogger(projectRoot: string): BoopLogger {
    const path = join(projectRoot, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME);
    const _logger = createLogger(path, null, BoopConfiguration.DEBUG == false, "silly");
    return _logger;
}

function logException(this: BoopLogger, exception: any, message?: string) {
    const msg = message ?? (exception instanceof Error ? exception.message : exception);
    this.error(msg, { exception: serializeError(exception) });
}

/**
 * Recursively converts an Error object to a plain object so JSON.stringify can fully serialise it.
 * @param error 
 * @returns 
 */
function parseError(error: Error) {
    const obj: any = {};
    obj.message = error.message;
    obj.stack = error.stack ?? "";
    if (error.cause) {
        if (error.cause instanceof Error) {
            obj.cause = parseError(error.cause);
        }
        else {
            obj.cause = error.cause;
        }
    }
    return obj;
}

/**
 * Regex to match timestamped project install and deploy logs.
 * 
 * Use the `reference` group to get the log's webhook event reference (commit ID that triggered the action).
 * Use the `timestamp` group to get the log's timestamp.
 */
const ProjectLogDirRegex = /^(?<timestamp>[\d+]{13,})(-(?<reference>[^\W_]{8}[-]?(?:[^\W_]{4}[-]?){3}[^\W_]{12}))?$/;

/**
 * Creates a valid log directory name that {@link listProjectLogs|listProjectLogs()} can see.
 * @param time The timestamp for the logged event.
 * @param ref The webhook event reference (commit ID that triggered the action).
 * @returns 
 */
export function makeLogDirName(time: number, ref?: string | null) {
    if (typeof time !== "number") {
        console.warn("Log filename is not compliant and will be invisible to search methods; use 'Date.now()'-like timestamps in milliseconds. ");
    }
    return `${time}${(ref == undefined || ref == null || ref.length == 0) ? "" : `-${ref}`}`
}

interface EventLogDirHandle {
    time: number,
    eventReference?: string,
    dir: string
}

export interface EventLog {
    time: number,
    ref: string | null
}

export interface ProcessLog {
    cmd: string,
    log: string,
    exitCode: number | null,
    startTime: number,
    exitTime: number,
    killed: boolean,
}

/**
 * Lists a project's log entries from a given category.
 * @param project 
 * @param category 
 * @returns List of per-event directories.
 */
export async function listProjectLogs(project: BoopProject, category: 'installer' | 'output') : Promise<EventLogDirHandle[]> {
    const logTypeDir = category == "installer" ? PROJECT_LOGS_INSTALL_DIR_NAME : PROJECT_LOGS_DEPLOY_DIR_NAME;
    const searchDir = join(project.projectDir, PROJECT_LOGS_DIR_NAME, logTypeDir);
    const dirs = await readdir(searchDir);
    const valids = dirs.filter(dir => ProjectLogDirRegex.test(dir) == true).map(dir => {
        const groups = ProjectLogDirRegex.exec(dir)!.groups;
        const _entry: EventLogDirHandle = {
            time: Number(groups!.timestamp),
            eventReference: groups?.reference,
            dir: join(searchDir, dir)
        }
        return _entry;
    });
    return valids;
}