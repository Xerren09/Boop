import winston from "winston";
import { LOG_FILE, PROJECT_LOG_FILE_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME } from "./constants.js";
import { join } from "path";
import { isDevEnv } from "./app/utilities.js";
import { readdir } from "fs/promises";
import { BoopProject } from "./app/project/boop.project.js";

export interface BoopLogger extends winston.Logger {
    /**
     * Logs an {@link Error} object with its `cause` property. Handles nested errors.
     * @param exception 
     * @returns 
     */
    logException: (exception: any) => void
}

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: LOG_FILE,
            format: winston.format.combine(
                winston.format.uncolorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                winston.format.metadata(),
                winston.format.json()
            ),
            level: "silly"
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
            level: "info"
        })
    ],
});

logger["logException"] = logException;

export default logger as BoopLogger;

export function createProjectLogger(projectRoot: string): BoopLogger {
    const _logger = winston.createLogger({
        transports: [
            new winston.transports.File({
                filename: join(projectRoot, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME),
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                    winston.format.errors(),
                    winston.format.metadata(),
                    winston.format.json()
                ),
                level: "silly"
            })
        ],
    });
    if (isDevEnv()) {
        _logger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
            level: "silly"
        }))
    }
    _logger["logException"] = logException;
    return _logger as BoopLogger;
}

function logException(this: BoopLogger, exception: any) {
    if (exception instanceof AggregateError) {
        this.error(exception.message);
        for (let index = 0; index < exception.errors.length; index++) {
            const error = exception.errors[index];
            this.logException(error);
        }
    }
    else if (exception instanceof SuppressedError) {
        this.error(exception.error);
        this.logException(exception.suppressed);
    }
    else if (exception instanceof Error) {
        this.error(exception.message);
        this.debug("Exception:", { exception: parseError(exception)});
    }
    else {
        this.error(exception);
    }
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
    ref?: string | null
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