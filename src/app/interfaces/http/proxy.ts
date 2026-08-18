import { type Request, type Response } from 'express';
import httpProxy from 'http-proxy-3';
import { IncomingMessage } from 'node:http';
import Stream from 'node:stream';
import Manager from '../../project/manager.js';
import { ServiceProject } from '../../project/service.project.js';
import { AppProject } from '../../project/app.project.js';

const projectIdFromUrlSegments = /^\/*(?<projectID>[\w-]+)\/?/;
// Isn't attached to a server so no cleanup required
const proxy = httpProxy.createProxyServer();

export function projectHttpProxy(project: ServiceProject, req: Request, res: Response) {
    if (project.deployed === false) {
        res.status(503).send("Project not deployed.");
        return;
    }
    const port = Number(project.environment.get("PORT") ?? -1);
    if (port == -1 || Number.isNaN(port)) {
        res.status(503).send(`
            <h1>503 - Service port not specified.</h1>

            <p>Can&#39;t proxy requests for this project (${project.name}); it did not specify a port.</p>

            <p>Boop normally provides a proxy router for services, but this requires the project to specify the port the service is listening at.</p>

            <p>Either:</p>

            <ul>
                <li>Set the <code>PORT</code> environment variable in the project&#39;s config.yaml file (<a href="https://github.com/Xerren09/Boop#project-configuration">example</a>).</li>
                <li>Or through the Boop web UI at <a href="http://${req.host}/boop/${project.name}">${project.name}</a>, by setting a <code>PORT</code> variable in the &quot;Environment&quot; tab.</li>
            </ul>
        `);
        return;
    }
    req.url = replaceInternalRouteFragment(project.name, req);
    proxy.web(req, res, { target: `http://localhost:${port}/` });
}

export function projectWsProxy(req: IncomingMessage, socket: Stream.Duplex, head: Buffer): boolean {
    const projectName = projectIdFromUrlSegments.exec(req.url!)?.groups?.projectID ?? "";
    const project = Manager.Find(projectName);
    if (!project) {
        return false;
    }
    if (project.deployed === false) {
        return false;
    }
    if (project instanceof AppProject) {
        return false;
    }
    const port = Number(project.environment.get("PORT") ?? -1);
    if (port == -1 || Number.isNaN(port)) {
        return false;
    }
    req.url = replaceInternalRouteFragment(project.name, req);
    proxy.ws(req, socket, head, { target: `http://localhost:${port}/` });
    return true;
}

function replaceInternalRouteFragment(fragment: string, req: IncomingMessage) {
    let path = req.url!.replace(`/${fragment}`, "");
    if (path === "/") {
        path = "";
    }
    return path;
}