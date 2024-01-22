import express from "express";
import httpProxy from "http-proxy"
const httpProxyServer = httpProxy.createProxyServer({
    ws: true,
});

/**
 * Creates a Proxy Host that redirects the request to the target server
 * @param {string} route Route name through which the server can be reached
 * @returns {Router}
 */
export function createServiceRouter(route: string, port: number) {
    var router = express.Router();
    //const redirectRoute = `/${route}/*`;
    router.use((req, res, next) => {
        // Remove the boop attachment route from the url so the Proxy Host gets the correct request
        req.url = req.url.replace(`/${route}`, "");
        if (req.url === "/") {
            req.url = "";
        }
        // Forward request to proxy
        if (port !== undefined) {
            httpProxyServer.web(req, res, {target: `http://localhost:${port}/`});
        }
        else {
            res.status(503).send(`
            <h1>503 - Service proxy unavailable</h1>

            <p>Can&#39;t proxy requests for this project (${route}); it did not specify a port.</p>

            <p>Boop normally provides a proxy router for services, but this requires the project to specify the port the service is listening at.</p>

            <p>Either:</p>

            <ul>
                <li>Set the PORT environment variable in the project&#39;s config.yaml file (<a href="https://github.com/Xerren09/Boop#project-configuration">example</a>).</li>
                <li>Or through the Boop web UI at <a href="http://${req.host}/boop/${route}">${route}</a>, and click the &quot;Edit variables&quot; option.</li>
            </ul>

            <p>If you have set the PORT variable, make sure your application is using it correctly on startup.</p>
            `);
        }
    });
    return router;
}

process.once("exit", () => {
    httpProxyServer.close();
});