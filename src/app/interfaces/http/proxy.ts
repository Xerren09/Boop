import { type NextFunction, type Request, type Response } from 'express';
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
    const port = project.environment.get("port");
    if (port === null) {
        // TODO: add message explaining that the port is missing
        res.sendStatus(503);
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
    if (project instanceof AppProject) {
        return false;
    }
    const port = project.environment.get("port");
    if (port === null) {
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