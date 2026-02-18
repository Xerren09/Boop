import { R_OK, W_OK } from "constants";
import { PathLike } from "fs";
import { access, readdir } from "fs/promises";
import net from "net";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Gets a very likely free port.
 * @returns 
 */
export function getFreePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer((socket) => {
            socket.end();
        });
        server.listen(() => {
            const addressInfo = server.address();
            if (addressInfo != null && typeof addressInfo != "string") {
                const port = addressInfo.port;
                server.close(() => {
                    resolve(port);
                });
            }
            else {
                reject();
            }
        });
    });
}

/**
 * Replacement for __dirname missing in ES Modules
 * @param importUrl The local file's `import.meta.url`
 * @returns
 */
export function resolve__dirname(importUrl: string) {
    const filename = fileURLToPath(importUrl);
    const _dirname = dirname(filename);
    return _dirname;
}

/**
 * Wrapper around {@link access} that resolves with `true` if the path exists, and `false` if it doesn't. Doesn't throw.
 * @param path 
 * @returns 
 */
export async function pathExists(path: PathLike): Promise<boolean> {
    try {
        await access(path, W_OK | R_OK);
        return true;
    }
    catch {
        return false;
    }
}

const RemoteURLNameRegex = /\/*(?<projectID>[\w-]+)$/;

/**
 * Gets the project's name from the GitHub remote url.
 * @param url 
 * @returns The project's name or null if not found.
 */
export function getProjectNameFromRemote(url: string) {
    const res = RemoteURLNameRegex.exec(url);
    return res?.groups?.projectID ?? null;
}

/**
 * Regex to match timestamped project install and deploy logs.
 * 
 * Use the `reference` group to get the log's webhook event reference (commit ID that triggered the action).
 * Use the `timestamp` group to get the log's timestamp.
 */
export const ProjectOutputLogfileRegex = /^(?<timestamp>[\d+]{13,})(-(?<reference>[^\W_]{8}[-]?(?:[^\W_]{4}[-]?){3}[^\W_]{12}))?.json$/;

/**
 * Creates JSON file with the given timestamp as the name.
 * @param time The timestamp for the logfile.
 * @param ref The webhook event reference (commit ID that triggered the action).
 * @returns 
 */
export function makeProjectOutputFileName(time: number, ref?: string) {
    if (typeof time !== "number") {
        console.warn("Log filename is not compliant and will be invisible to search methods; use 'Date.now()'-like timestamps in milliseconds. ");
    }
    return `${time}${(ref == undefined || ref == null) ? "" : `-${ref}`}.json`
}

/**
 * Searches a list of output files based on the criteria.
 * @param files The list of filenames to search through.
 * @param searchFor A filename, timestamp, or `undefined`. If not given, the latest timestamped file will be returned, if any.
 * @returns The filename of the result, or `null` is no matches were found.
 */
export function searchProjectOutputFile(files: string[], searchFor: string | number | undefined) {
    let logFileName: string | null = null;
    if (files.length == 0) {
        return null;
    }
    if (searchFor == undefined) {
        const num = Math.max(...files.map(el => Number(ProjectOutputLogfileRegex.exec(el).groups.timestamp)));
        logFileName = makeProjectOutputFileName(num);
    }
    else if (typeof searchFor === "number") {
        const name: string = makeProjectOutputFileName(searchFor);
        logFileName = files.find(el => el === name);
    }
    else if (typeof searchFor === "string") {
        logFileName = files.find(el => el === searchFor);
    }
    return logFileName;
}

/**
 * Gets the list of all valid project output files in a given directory.
 * @param dir 
 * @returns 
 */
export async function getAllProjectOutputFiles(dir: string) {
    const files = await readdir(dir);
    const logs = files.filter(file => ProjectOutputLogfileRegex.test(file) == true);
    return logs;
}

export interface IDisposable extends Disposable {
    /**
     * The `disposed` property indicates if the object was disposed of via \[{@link Symbol.dispose}]().
     */
    get disposed(): boolean;
}

export interface IAsyncDisposable extends AsyncDisposable{
    /**
     * The `disposed` property indicates if the object was disposed of via \[{@link Symbol.asyncDispose}]().
     */
    get disposed(): boolean;
}