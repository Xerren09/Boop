import type { NextFunction, Response, Request } from "express";
import Manager from "../project/manager.js";
import { ServiceProject } from "../project/service.project.js";

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
    if (project) {
        if (project.router) {
            project.router(req, res, next);
        }
        else {
            res.status(503).send(`
            <h1>503 - Project router unavailable</h1>

            <p>Can&#39;t forward requests for this project (${projectName}); its router is not available. Generally this means the project is not currently deployed.</p>


            ${
                project instanceof ServiceProject ? `
                
                <p>For Service projects:</p>
                
                <ul>
                    <li>Make sure the project is deployed.</li>
                    <li>Ensure the <code>PORT</code> environment variable is set in the project&#39;s config.yaml file (<a href="https://github.com/Xerren09/Boop#project-configuration">example</a>).</li>
                    <li>Or through the Boop web UI at <a href="http://${req.host}/boop/${projectName}">${projectName}</a>, in the &quot;Environment&quot; tab.</li>
                </ul>

                <p>If you have set the <code>PORT</code> variable, make sure your application is using it correctly on startup.</p>
                ` : ""
            }
            <p>For App projects:</p>

            ${
                (project instanceof ServiceProject) == false ? `
                
                <p>For App projects:</p>
                
                <ul>
                    <li>Make sure the project is deployed.</li>
                </ul>
                ` : ""
            }
            `);
        }
    }
    else {
        next();
    }
}