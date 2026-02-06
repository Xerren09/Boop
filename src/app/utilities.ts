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

/**
 * Regex to match project install and deploy logs.
 */
export const ProjectOutputLogfileRegex = new RegExp(/(\d*)(?=\.json)/);

/**
 * Creates JSON file with the given timestamp as the name.
 * @param time 
 * @returns 
 */
export function makeProjectOutputFileName(time: number) {
    return `${time}.json`
}