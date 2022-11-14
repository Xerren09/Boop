const express = require('express');
const httpProxy = require('http-proxy');
const httpProxyServer = httpProxy.createProxyServer();
const path = require('path');

/**
 * Creates a Proxy Host that redirects the request to the target server
 * @param {string} route Route name through which the server can be reached
 * @param {string} targetURL URL of the target server (eg: `https://localhost:3000`)
 * @returns {Router}
 */
function createProxyHost(route, targetURL) {
    var router = express.Router();
    const redirectRoute = `/${route}/*`;
    router.all(redirectRoute, function(req, res, next) {
        // Remove the attachment route from the url so the Proxy Host gets the correct request
        const original = req.url;
        req.url = req.url.replace(`/${route}`, "");
        // Forward request to proxy
        httpProxyServer.web(req, res, {target: targetURL}, (err)=>{
            const host = req.get('Host');
            const error503resource = req.protocol + '://' + host + original;
            res.status(503).render('503.spy', { error503resource: error503resource, domain: host});        
        });
    });
    return router;
}
/**
 * Creates a Website Host that redirects the request to the target server
 * @param {string} route Route name through which the server can be reached
 * @param {path|string} indexPath Path pointing to the root HTML file
 * @param {path|string} rootPath Path pointing to the root directory containing all website files
 * @returns {Router}
 */
function createWebsiteHost(route, indexPath, rootPath) {
    var router = express.Router();
    const redirectRoute = `/${route}/*`;
    const staticRedirectRoute = `/${route}`;
    indexPath = path.normalize(indexPath);
    const staticPath = indexPath.substring(0, indexPath.lastIndexOf('/')) || indexPath.substring(0, indexPath.lastIndexOf('\\'));
    router.use(staticRedirectRoute, express.static(staticPath));
    router.get(redirectRoute, function(req, res, next) {
        res.sendFile(indexPath);
    });
    return router;
}

/**
 * Grabs a free available port to run a hosted app on
 * @param {(port:number)=>{}} callback 
 */
function getFreePort(callback) {
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

module.exports = {
    createProxyHost,
    createWebsiteHost,
    getFreePort
};