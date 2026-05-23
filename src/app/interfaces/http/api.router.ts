import express from "express";
import expressWs from "express-ws";
import cors from "cors";
import { createReadStream } from "fs";
import { finished } from "stream/promises";
import { readFile } from "fs/promises";
import { join } from "path";
//
import { PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME, PROJECT_LOG_FILE_NAME, PROJECT_LOG_RESULT_FILE_NAME, PROJECT_LOGS_DIR_NAME } from "../../../constants.js";
import Manager from "../../project/manager.js";
import { ServiceProject } from "../../project/service.project.js";
import { InstallStreamer } from "./ws/install.streamer.js";
import { ProjectStreamer } from "./ws/project.streamer.js";
import { listProjectLogs } from "../../../logger.js";
import { pathExists } from "../../utilities.js";

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
    const path = join(project.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME);
    try {
        res.contentType("text");
        await using stream = createReadStream(path);
        stream.pipe(res, { end: false });
        await finished(stream, { cleanup: true });
    }
    catch (err) {
        if (err instanceof SuppressedError) {
            err = err.suppressed;
        }
        if (res.headersSent == false) {
            res.status(500).json(err);
        }
    }
    finally {
        res.end();
    }
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
            const files = await listProjectLogs(project, "output");
            res.status(200).json(files);
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
    if (project instanceof ServiceProject) {
        const logTime = Number(req.params.log);
        const wantsProcessOutput = `${req.query?.process}`.toLowerCase() == "true";
        try {
            const logs = await listProjectLogs(project, "output");
            const log = logs.find(el => el.time == logTime);
            if (!log) {
                return res.sendStatus(404);
            }
            if (wantsProcessOutput) {
                const path = join(log.dir, PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME);
                if (await pathExists(path) == false) {
                    return res.status(404).send(`No output file found with for this log.`);
                }
                try {
                    res.contentType("text");
                    await using stream = createReadStream(path);
                    stream.pipe(res, { end: false });
                    await finished(stream, {cleanup: true});
                }
                catch (err) {
                    if (err instanceof SuppressedError) {
                        err = err.suppressed;
                    }
                    if (res.headersSent == false) {
                        res.status(500).json(err);
                    }
                }
                finally {
                    res.end();
                }
            }
            else {
                const content = await readFile(join(log.dir, PROJECT_LOG_RESULT_FILE_NAME));
                res.status(200).json(JSON.parse(content.toString()));
            }
        }
        catch (err) {
            res.status(500).json(err);
        }
    }
    else {
        res.sendStatus(404);
    }
});

apiRouter.get("/projects/:projectName/logs/install", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        const files = await listProjectLogs(project, "installer");
        res.status(200).json(files);
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
        const logStep = Number(req.query["step"] ?? -1);
        const logTime = Number(req.params.log);
        if (Number.isNaN(logTime)) {
            res.status(400).send(`"${req.params.log}" is not a valid number.`);
        }
        const files = await listProjectLogs(project, "installer");
        const log = files.find(el => el.time == logTime);
        if (!log) {
            return res.status(404).send("No logfile found.");
        }
        if (logStep == -1) {
            // Send back installer result only
            const content = await readFile(join(log.dir, PROJECT_LOG_RESULT_FILE_NAME));
            res.json(JSON.parse(content.toString()));
        }
        else {
            // Send back process output
            const path = join(log.dir, `${logStep}.log`)
            if (await pathExists(path) == false) {
                return res.status(404).send(`No step file found with ID "${logStep}".`);
            }
            try {
                res.contentType("text");
                await using stream = createReadStream(path);
                stream.pipe(res, { end: false });
                await finished(stream, {cleanup: true});
            }
            catch (err) {
                if (err instanceof SuppressedError) {
                    err = err.suppressed;
                }
                if (res.headersSent == false) {
                    res.status(500).json(err);
                }
            }
            finally {
                res.end();
            }
        }
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.ws("/projects/:projectName", (ws, req) => {
    const project = Manager.projects.find(item => item.name === req.params["projectName"]);
    if (project) {
        const withServiceProcess = (req.query["withProcess"] ?? false) == "true";
        const streamer = new ProjectStreamer(ws, project, withServiceProcess);
        ws.once("close", () => {
            streamer[Symbol.dispose]();
        });
    }
    else {
        ws.close();
    }
});

apiRouter.ws("/projects/:projectName/installer", (ws, req) => {
    const project = Manager.projects.find(item => item.name === req.params["projectName"]);
    if (project) {
        const streamer = new InstallStreamer(ws, project)
        ws.once("close", () => {
            streamer[Symbol.dispose]();
        });
    }
    else {
        ws.close();
    }
});

apiRouter.post("/projects/:projectName/start", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        await project.deploy();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.post("/projects/:projectName/stop", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        await project.stop();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.post("/projects/:projectName/restart", async (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    try {
        await project.restart();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(err);
    }
});

apiRouter.get("/projects/:projectName/env", (req, res) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        return;
    }
    res.status(200).json(project.environment.variables);
});

apiRouter.patch("/projects/:projectName/env", (req, res) => {
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