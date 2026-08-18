import type { NextFunction, Response, Request } from "express";
import Manager from "../../project/manager.js";
import { ServiceProject } from "../../project/service.project.js";
import { AppProject } from "../../project/app.project.js";
import { projectHttpProxy } from "./proxy.js";

const projectIdFromUrlSegments = /^\/*(?<projectID>[\w-]+)\/?/;

/**
 * Selects the requested project's host and directs the request to it.
 * @param req 
 * @param res 
 * @param next 
 */
export function projectSelector(req: Request, res: Response, next: NextFunction) {
    const projectName = projectIdFromUrlSegments.exec(req.url)?.groups?.projectID ?? "";
    const project = Manager.Find(projectName);
    if (!project) {
        res.status(404).send(`
        <h1>404 - Resource not found.</h1>

        <p>Can&#39;t find the requested resource (${req.url}); it does not point to any known projects.</p>

        <p>Project routers are prefixed with the project's url compliant name; for example the project called "example-project" will be available at "/example-project/".</p>

        <p>If you are trying to access an SPA, ensure that it is built with its base path set to the project's name, or resources will not resolve correctly.</p>
        `);
        return;
    }
    if (!project.deployed) {
        res.status(503).send(`
        <h1>503 - Project router unavailable</h1>

        <p>Can&#39;t forward requests for this project (${projectName}); its router is not available. Generally this means the project is not currently deployed.</p>


        ${
            project instanceof ServiceProject ? `
                
            <p>For Service projects:</p>
                
            <ul>
                <li>Make sure the project is deployed.</li>
                <li>Ensure the <code>PORT</code> environment variable is set in the project&#39;s config.yaml file (<a href="https://github.com/Xerren09/Boop#project-configuration">See how to configure a project build file</a>).</li>
                <li>Or through the Boop web UI at <a href="http://${req.host}/boop/${projectName}">${projectName}</a>, in the &quot;Environment&quot; tab.</li>
            </ul>

            <p>If you have set the <code>PORT</code> variable, make sure your application is using it correctly on startup.</p>
            ` : ""
        }

        ${
            (project instanceof ServiceProject) == false ? `
                
            <p>For App projects:</p>
                
            <ul>
                <li>Make sure the project is deployed.</li>
                <li>Ensure the <code>entry</code> property of the config.yaml file points to the app's index file and it is a valid path.</li>
            </ul>
            ` : ""
        }
        `);
        return;
    }
    if (project instanceof ServiceProject) {
        projectHttpProxy(project, req, res);
    }
    else if (project instanceof AppProject) {
        if (project.router) {
            project.router(req, res, next);
        }
        else {
            res.status(503).send(`Project router not available.`);
        }
    }
}