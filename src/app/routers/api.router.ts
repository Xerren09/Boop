import express from "express";
import cors from "cors";
import { readFile } from "fs/promises";
import expressWs from "express-ws";
import Manager from "../project/manager.js";
import { ServiceProject } from "../project/service.project.js";
import { ProjectStreamer } from "../project/projectStreamer.js";
import { randomUUID } from "crypto";
import { InstallLogFileRegex } from "../shell/installRunner.js";
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
        uptime: Math.floor(process.uptime()) * 1000,
        nodeVer: process.version,
        system: process.platform
    };
    res.status(200).json(ret);
});

apiRouter.get("/projects", (_req, res) => {
    const ret = Manager.projects.map(project => ({
        name: project.name,
        deployed: project.deployed,
        type: project.type,
        lastEvent: project.webhookEvents.lastEvent?.time || 0,
        remote: project.remoteUrl
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
        deployed: project.deployed,
        lastDeployed: project.webhookEvents.lastEvent?.time || 0,
        remote: project.remoteUrl,
        type: project.type,
        events: project.webhookEvents.events,
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

apiRouter.get("/projects/:projectName/logs", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    const files = await project.installer.getLogs();
    const ret = files.map(el => ({
        time: Number(InstallLogFileRegex.exec(el)[0]),
        name: el
    }));
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName/log/:log", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    const time = Number(req.params.log);
    if (isNaN(time) == false) {
        const file = await project.installer.findLog(time);
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
        res.status(400).send("Time parameter not valid.");
    }
});

const streamers: {handle: string, streamer: ProjectStreamer}[] = [];

apiRouter.ws("/projects/:projectName/installer", (ws, req) => {
    const project = Manager.projects.find(item => item.name === req.params["projectName"]);
    if (project) {
        const handle = randomUUID();
        streamers.push({
            handle: handle,
            streamer: new ProjectStreamer(ws, project)
        });
        ws.once("close", () => {
            const idx = streamers.findIndex(item => item.handle === handle);
            if (idx != -1) {
                streamers[idx]?.streamer.dispose();
                streamers.splice(idx, 1);
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
    }).catch(() => {
        res.sendStatus(500);
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
        res.status(202);
    }
    else {
        res.status(400);
    }
});

apiRouter.delete("/projects/:projectName/env", (req, res) => {
    if (req.body.key != undefined) {
        const project = Manager.projects.find(item => item.name === req.params.projectName);
        if (project == undefined) {
            return;
        }
        project.environment.delete(req.body.key);
        res.status(202);
    }
    else {
        res.status(400);
    }
});