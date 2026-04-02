import winston from "winston";
import { LOG_FILE, PROJECT_LOG_FILE_NAME, PROJECT_LOGS_DIR_NAME } from "./constants.js";
import { join } from "path";
import { isDevEnv } from "./app/utilities.js";

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

function logException(this: winston.Logger, exception: any) {
    if (exception instanceof AggregateError) {
        this.error(exception.message);
        for (let index = 0; index < exception.errors.length; index++) {
            const error = exception.errors[index];
            this.debug(`Exception [${index}]:`, { exception: parseError(error)});
        }
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