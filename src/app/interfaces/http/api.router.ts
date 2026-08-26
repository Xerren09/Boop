import express from "express";
import { createReadStream } from "fs";
import { finished } from "stream/promises";
import { readFile } from "fs/promises";
import { join } from "path";
//
import { PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME, PROJECT_LOG_FILE_NAME, PROJECT_LOG_RESULT_FILE_NAME, PROJECT_LOGS_DIR_NAME } from "../../constants.js";
import Manager from "../../project/manager.js";
import { ServiceProject } from "../../project/service.project.js";
import logger, { listProjectLogs } from "../../log.js";
import { pathExists } from "../../utilities.js";
import type { BoopProject } from "../../project/boop.project.js";
import { serializeError } from "serialize-error";

declare module 'express-serve-static-core' {
    interface Request {
        project: BoopProject;
    }
}

async function handleFileStreamResponse(filePath: string, res: express.Response) {
    try {
        res.contentType("text");
        await using stream = createReadStream(filePath);
        stream.pipe(res, { end: false });
        await finished(stream, {cleanup: true});
    }
    catch (err) {
        if (err instanceof SuppressedError) {
            err = err.suppressed;
        }
        if (res.headersSent == false) {
            res.status(500).json(serializeError(err));
        }
        else {
            logger.logException(err);
        }
    }
    finally {
        res.end();
    }
}

export const apiRouter = express.Router();

// Boop general API

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

// Projects control API

// Project guard
apiRouter.use("/projects/:projectName", (req, res, next) => {
    const project = Manager.projects.find(item => item.name === req.params.projectName);
    if (project == undefined) {
        res.status(404).send(`No project with the name "${req.params.projectName}" is installed.`);
        return;
    }
    else {
        req.project = project;
        next();
    }
});

apiRouter.get("/projects/:projectName", (req, res) => {
    const project = req.project;
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
    const project = req.project;
    try {
        await Manager.Delete(project);
        res.sendStatus(200);
    }
    catch (error) {
        res.status(500).json(serializeError(error));
    }
});

apiRouter.get("/projects/:projectName/logs/project", async (req, res) => {
    const project = req.project;
    const path = join(project.projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOG_FILE_NAME);
    if (await pathExists(path) == false) {
        return res.status(404).send("Log file not found.");
    }
    return await handleFileStreamResponse(path, res);
});

apiRouter.get("/projects/:projectName/logs/webhook", async (req, res) => {
    const project = req.project;
    const ret = project.webhookEvents.events;
    res.status(200).json(ret);
});

apiRouter.get("/projects/:projectName/logs/deploy", async (req, res) => {
    const project = req.project;
    try {
        if (project instanceof ServiceProject) {
            const files = await listProjectLogs(project, "output");
            res.status(200).json(files);
        }
        else {
            res.status(400).send("Service projects do not keep deploy logs.");
        }
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.get("/projects/:projectName/logs/deploy/:log", async (req, res) => {
    const project = req.project;
    if (project instanceof ServiceProject == false) {
        return res.status(400).send("Service projects do not keep deploy logs.");
    }
    const logTime = Number(req.params.log);
    if (Number.isNaN(logTime)) {
        return res.status(400).send("Log timestamp is not a number.");
    }
    const wantsProcessOutput = `${req.query?.process}`.toLowerCase() == "true";
    try {
        const deployLogs = await listProjectLogs(project, "output");
        const log = deployLogs.find(el => el.time == logTime);
        if (log === undefined) {
            return res.status(404).send("No matching deploy log found.");
        }
        if (wantsProcessOutput) {
            const path = join(log.dir, PROJECT_LOG_DEPLOY_OUTPUT_FILE_NAME);
            if (await pathExists(path) == false) {
                return res.status(404).send(`No output file found for this log.`);
            }
            return await handleFileStreamResponse(path, res);
        }
        else {
            const content = await readFile(join(log.dir, PROJECT_LOG_RESULT_FILE_NAME));
            res.status(200).json(JSON.parse(content.toString()));
        }
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.get("/projects/:projectName/logs/install", async (req, res) => {
    const project = req.project;
    try {
        const files = await listProjectLogs(project, "installer");
        res.status(200).json(files);
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.get("/projects/:projectName/logs/install/:log", async (req, res) => {
    const project = req.project;
    const logTime = Number(req.params.log);
    if (Number.isNaN(logTime)) {
        return res.status(400).send("Log timestamp is not a number.");
    }
    const logStep = Number(req.query["step"] ?? -1);
    try {
        const files = await listProjectLogs(project, "installer");
        const log = files.find(el => el.time == logTime);
        if (!log) {
            return res.status(404).send("No matching install log found.");
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
            return await handleFileStreamResponse(path, res);
        }
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.post("/projects/:projectName/start", async (req, res) => {
    const project = req.project;
    try {
        await project.deploy();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.post("/projects/:projectName/stop", async (req, res) => {
    const project = req.project;
    try {
        await project.stop();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.post("/projects/:projectName/restart", async (req, res) => {
    const project = req.project;
    try {
        await project.restart();
        res.sendStatus(200);
    }
    catch (err) {
        res.status(500).json(serializeError(err));
    }
});

apiRouter.get("/projects/:projectName/env", (req, res) => {
    const project = req.project;
    res.status(200).json(project.environment.variables);
});

apiRouter.get("/projects/:projectName/env/:key", (req, res) => {
    const project = req.project;
    const val = project.environment.get(req.params.key);
    if (val != null) {
        res.status(200).json(val);
    }
    else {
        res.status(404).send("No environment variable found.");
    }
});

apiRouter.patch("/projects/:projectName/env", (req, res) => {
    const project = req.project;
    if (req.body?.key != undefined && req.body?.value != undefined) {
        project.environment.set(req.body.key, req.body.value);
        res.sendStatus(200);
    }
    else {
        const badKey = req.body?.key == undefined;
        const badValue = req.body?.value == undefined;
        res.status(400).send(`Invalid arguments: ${badKey ? "key" : ""} ${badKey && badValue ? " and ": ""} ${badValue ? "value" : ""} undefined.`);
    }
});

apiRouter.delete("/projects/:projectName/env", (req, res) => {
    const project = req.project;
    if (req.body.key != undefined) {
        project.environment.delete(req.body.key);
        res.sendStatus(200);
    }
    else {
        res.status(404).send("No environment variable found.");
    }
});