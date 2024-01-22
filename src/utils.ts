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
                server.close(()=>{
                    resolve(port);
                });
            }
            else {
                reject();
            }
        });
    });
}

export function getArgValue(flag: string) {
    const flagIndex = process.argv.findIndex(el => el.toLowerCase() == flag.toLowerCase());
    if (flagIndex != -1) {
        const flagValIndex = flagIndex + 1;
        if (process.argv.length > (flagValIndex) && (process.argv[flagValIndex].startsWith('--') == false)) {
            return process.argv[flagValIndex];
        }
        else {
            return undefined;
        }
    }
    else {
        return undefined;
    }
}

export function __dirname(importUrl: string) {
    const filename = fileURLToPath(importUrl);
    const _dirname = dirname(filename);
    return _dirname;
}