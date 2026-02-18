import { R_OK, W_OK } from "constants";
import { PathLike } from "fs";
import { access } from "fs/promises";
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
export const ProjectOutputLogfileRegex = /^((?<reference>[\w+]{7,})?-)?(?<timestamp>[\d+]{13,}).json$/;

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
    return `${ref ?? ""}${ref === undefined ? "" : "-"}${time}.json`
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