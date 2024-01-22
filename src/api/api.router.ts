import express from "express";
import cors from "cors";
import { activeProjects } from "../app/projects/index.js";
import { ProjectStreamer } from "./projectStreamer.js";
import { rm } from "fs/promises";
import expressWs from "express-ws";
export const apiRouter = express.Router();
//@ts-expect-error
expressWs(apiRouter);
apiRouter.use(cors());

apiRouter.get("/status", (req, res, next) => {
    const ret = {
        projects: activeProjects.length,
        uptime: Math.floor(process.uptime()) * 1000,
        nodeVer: process.version,
        system: process.platform
    };
    res.status(200).json(ret);
});

apiRouter.get("/projects", (req, res, next) => {
    const ret = activeProjects.map(el => ({
        name: el.name,
        deployed: el.deployed,
        type: el.type,
        lastEvent: el.lastEvent?.time || 0,
        remote: el.remoteUrl
    }));
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        const ret = {
            name: project.name,
            deployed: project.deployed,
            lastDeployed: project.lastDeployed,
            remote: project.remoteUrl,
            type: project.type,
            events: project.events,
        }
        res.status(200).json(ret);
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.delete("/projects/:projectName", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        project.stop().then(() => {
            return rm(project.projectRootPath, { recursive: true, force: true }).then(() => {
                res.status(200);
            })
        }).catch(err => {
            res.status(500).json(err);
        });
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.get("/projects/:projectName/logs", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        if (req.query.time && isNaN(Number(req.query.time)) == false ) {
            const ret = project.getInstallLog(Number(req.query.time));
            if (ret) {
                res.status(200).json({
                    ...ret || {},
                    type: "installerHistory"
                });
            }
            else {
                res.sendStatus(404);
            }
        }
        else {
            const ret = project.getInstallLogList().map(el => ({
                time: Number(el.split("-")[1].split(".")[0]),
                name: el
            }));
            res.status(200).json(ret);
        }
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.ws("/projects/:projectName/installer", (ws, req, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        let streamer = new ProjectStreamer(ws, project);
        ws.once("close", () => {
            streamer.dispose();
            streamer = undefined;
        });
    }
    else {
        ws.close();
    }
});

apiRouter.post("/projects/:projectName/start", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        project.start().then(() => {
            res.sendStatus(202);
        }).catch(() => {
            res.sendStatus(500);
        });
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.post("/projects/:projectName/stop", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        project.stop().then(() => {
            res.sendStatus(202);
        }).catch(() => {
            res.sendStatus(500);
        });
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.post("/projects/:projectName/restart", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        project.restart().then(() => {
            res.sendStatus(202);
        }).catch(() => {
            res.sendStatus(500);
        });
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.get("/projects/:projectName/env", (req, res, next) => {
    const project = activeProjects.find(el => el.name === req.params.projectName);
    if (project) {
        res.send(project.env);
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.post("/projects/:projectName/env", (req, res, next) => {
    if (req.body.key != undefined && req.body.value != undefined) {
        const project = activeProjects.find(el => el.name === req.params.projectName);
        if (project) {
            project.setEnvKey(req.body.key, req.body.value);
            res.sendStatus(202);
        }
        else {
            res.sendStatus(404);
        }
    }
    else {
        res.sendStatus(400);
    }
});

apiRouter.delete("/projects/:projectName/env", (req, res, next) => {
    if (req.body.key != undefined) {
        const project = activeProjects.find(el => el.name === req.params.projectName);
        if (project) {
            project.removeEnvKey(req.body.key);
            res.sendStatus(202);
        }
        else {
            res.sendStatus(404);
        }
    }
    else {
        res.sendStatus(400);
    }
});