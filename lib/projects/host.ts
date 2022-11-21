import * as express from "express"
import * as path from "path"
import httpProxy from "http-proxy"
const httpProxyServer = httpProxy.createProxyServer({});

/**
 * Creates a Proxy Host that redirects the request to the target server
 * @param {string} route Route name through which the server can be reached
 * @returns {Router}
 */
export function createProxyHost(route: string, port: number) {
    var router = express.Router();
    const redirectRoute = `/${route}/*`;
    router.all(redirectRoute, function(req, res, next) {
        // Remove the boop attachment route from the url so the Proxy Host gets the correct request
        req.url = req.url.replace(`/${route}`, "");
        // Forward request to proxy
        httpProxyServer.web(req, res, {target: `http://localhost:${port}`});
    });
    return router;
}

/**
 * Creates a Website Host that redirects the request to the target server
 * @param {string} route Route name through which the server can be reached
 * @param {string} indexPath Path pointing to the root HTML file
 * @returns {Router}
 */
export function createWebsiteHost(route: string, indexPath: string) {
    var router = express.Router();
    const redirectRoute = `/${route}/*`;
    const staticRedirectRoute = `/${route}`;
    indexPath = path.normalize(indexPath);
    const rootPath = indexPath.substring(0, indexPath.lastIndexOf('/')) || indexPath.substring(0, indexPath.lastIndexOf('\\'));
    router.use(staticRedirectRoute, express.static(rootPath));
    router.get(redirectRoute, function(req, res, next) {
        res.sendFile(indexPath);
    });
    return router;
}

/**
 * Grabs a free available port to run a hosted app on
 * @param {(port:number)=>void} callback 
 */
export function getFreePort(callback: (port: number)=>void) {
    const net = require('net');
    const server = net.createServer((socket) => {
        socket.end();
    });
    server.listen(()=>{
        const port = server.address().port;
        server.close(()=>{
            callback(port);
        });
    });
}