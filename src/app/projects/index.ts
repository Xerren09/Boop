import { Request, Response, NextFunction } from "express";
import { BoopProject } from "./project.js";

export const activeProjects: BoopProject[] = [];

/**
 * Selects the requested project's host and directs the request to it.
 * @param req 
 * @param res 
 * @param next 
 */
export function projectSelector(req: Request, res: Response, next: NextFunction) {
    const projectName = req.url.split("/")[1];
    const project = activeProjects.find(el => el.name == projectName);
    if (project) {
        // Forward to project host
        if (project.router) {
            project.router(req, res, next);
        }
        else {
            next();
        }
    }
    else {
        next();
    }
}