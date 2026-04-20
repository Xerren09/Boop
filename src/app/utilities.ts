import { R_OK, W_OK } from "constants";
import { createReadStream, PathLike } from "fs";
import { access } from "fs/promises";
import net from "net";
import { dirname } from "path";
import Stream, { Duplex, Readable } from "stream";
import { finished } from "stream/promises";
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

const RemoteURLNameRegex = /(?<projectID>[^/]+)(?=\/$|$)/;

/**
 * Gets the project's name from the GitHub remote url.
 * @param url 
 * @returns The project's name or null if not found.
 */
export function getProjectNameFromRemote(url: string) {
    const res = RemoteURLNameRegex.exec(url);
    return res?.groups?.projectID ?? null;
}

export function isDevEnv(): boolean {
    return process.env["NODE_ENV"] == "development";
}

export function isNodeErrnoException(err: any, code?: string): err is NodeJS.ErrnoException {
    return (err instanceof Error) && ((err as NodeJS.ErrnoException).code !== undefined) && (code !== undefined ? (err as NodeJS.ErrnoException).code == code : true)
}

export function isNodeAbortException(err: any): err is NodeJS.ErrnoException {
    return (err instanceof Error) && ((err as NodeJS.ErrnoException).code !== undefined) && ((err as NodeJS.ErrnoException).code === "ABORT_ERR")
}

export function createCompositeStream(file: string, stream: Stream.Readable, cancel?: AbortSignal) {
    const _ret = new Duplex();
    const fileSource = createReadStream(file, { signal: cancel });
    _progressThroughStreams(_ret, fileSource, stream);   
    return _ret as Readable;
}
async function _progressThroughStreams(destination: Stream.Writable, ...sources: Stream.Readable[]) {
    try {
        for (let index = 0; index < sources.length; index++) {
            const element = sources[index];
            const isLast = (index + 1 == sources.length);
            element.pipe(destination, { end: isLast });
            await finished(element, { cleanup: true });
        }
    }
    catch (err) {
        destination.emit("error", err);
    }
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