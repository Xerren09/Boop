import express from "express";
import cors from "cors";
import { readFile } from "fs/promises";
import expressWs from "express-ws";
import Manager from "../project/manager.js";
import { ProjectStreamer } from "../project/projectStreamer.js";
import { join } from "path";
import { PROJECT_LOG_FILE_NAME, PROJECT_LOGS_DIR_NAME } from "../../constants.js";
import { ProjectOutputLogfileRegex } from "../utilities.js";
import { ServiceProject } from "../project/service.project.js";
export const apiRouter = express.Router();
//@ts-expect-error
expressWs(apiRouter);
apiRouter.use(cors());

apiRouter.use("/projects/:projectName", (req, res, next) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        res.status(404).send(`No project with the name ${project} exists.`);
        return;
    }
    else {
        next();
    }
});

apiRouter.get("/status", (_req, res) => {
    const ret = {
        projects: Manager.projects.length,
        uptime: Math.floor(process.uptime()),
        nodeVer: process.version,
        system: process.platform,
        arch: process.arch
    };
    res.status(200).json(ret);
});

apiRouter.get("/projects", (_req, res) => {
    const ret = Manager.projects.map(project => ({
        name: project.name,
        remote: project.remoteUrl,
        type: project.type,
        deployed: project.deployed,
        lastEventTime: project.webhookEvents.lastEvent?.time ?? 0,
    }));
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    const ret = {
        name: project.name,
        remote: project.remoteUrl,
        type: project.type,
        deployed: project.deployed,
        lastEvent: project.webhookEvents.lastEvent ?? null,
        localPort: project.environment.get("port") ?? null
    }
    res.status(200).json(ret);
});

apiRouter.delete("/projects/:projectName", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        await Manager.Delete(project);
        res.sendStatus(200);
    }
    catch (error) {
        res.status(500).json(error);
    }
});

apiRouter.get("/projects/:projectName/logs/project", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    const path = join(project.rootDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME);
    const ret = (await readFile(path)).toString().replace(/\r\n/g,'\n').split('\n');;
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName/logs/webhook", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    const ret = project.webhookEvents.events;
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName/logs/deploy", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        if (project instanceof ServiceProject) {
            const files = await project.getLogs();
            const ret = files.map(el => ({
                time: Number(ProjectOutputLogfileRegex.exec(el).groups.timestamp),
                name: el
            }));
            res.status(200).json(ret);
        }
        else {
            res.sendStatus(404);
        }
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.get("/projects/:projectName/logs/deploy/:log", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        if (project instanceof ServiceProject) {
            const num = Number(req.params.log);
            const file = await project.findLog(Number.isNaN(num) ? num : req.params.log);
            if (file == null) {
                res.status(404).send("No logfile found.");
            }
            else {
                try {
                    const text = await (await readFile(file)).toString();
                    res.status(200).json(JSON.parse(text));
                }
                catch (error) {
                    res.status(500).json(error)
                }
            }
        }
        else {
            res.sendStatus(404);
        }
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.get("/projects/:projectName/logs/install", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        const files = await project.installer.getLogs();
        const ret = files.map(el => ({
            time: Number(ProjectOutputLogfileRegex.exec(el).groups.timestamp),
            name: el
        }));
        res.status(200).json(ret);
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.get("/projects/:projectName/logs/install/:log", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        const num = Number(req.params.log);
        const file = await project.installer.findLog(Number.isNaN(num) ? num : req.params.log);
        if (file == null) {
            res.status(404).send("No logfile found.");
        }
        else {
            const text = await (await readFile(file)).toString();
            res.status(200).json(JSON.parse(text));
        }
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.ws("/projects/:projectName/installer", (ws, req) => {
    const project = Manager.projects.find(item => item.name === req.params["projectName"]);
    if (project) {
        const streamer = new ProjectStreamer(ws, project)
        ws.once("close", () => {
            if (streamer.disposed === false) {
                streamer[Symbol.dispose]();
            }
        });
    }
    else {
        ws.close();
    }
});

apiRouter.post("/projects/:projectName/start", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    project.deploy().then(() => {
        res.sendStatus(200);
    }).catch((err) => {
        res.status(500).json(err);
    });
});

apiRouter.post("/projects/:projectName/stop", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    project.stop().then(() => {
        res.sendStatus(200);
    }).catch((err) => {
        res.status(500).json(err);
    });
});

apiRouter.post("/projects/:projectName/restart", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    project.restart().then(() => {
        res.sendStatus(200);
    }).catch((err) => {
        res.status(500).json(err);
    });
});

apiRouter.get("/projects/:projectName/env", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    res.status(200).json(project.environment.variables);
});

apiRouter.post("/projects/:projectName/env", (req, res) => {
    if (req.body.key != undefined && req.body.value != undefined) {
        const project = Manager.projects.find(item => item.name === req.params.projectName);
        if (project == undefined) {
            return;
        }
        project.environment.set(req.body.key, req.body.value);
        res.sendStatus(202);
    }
    else {
        res.sendStatus(400);
    }
});

apiRouter.delete("/projects/:projectName/env", (req, res) => {
    if (req.body.key != undefined) {
        const project = Manager.projects.find(item => item.name === req.params.projectName);
        if (project == undefined) {
            return;
        }
        project.environment.delete(req.body.key);
        res.sendStatus(202);
    }
    else {
        res.sendStatus(400);
    }
});