#!/usr/bin/env node

import express from 'express';
import expressWs from "express-ws";
const app = express();
expressWs(app);
import { config } from "dotenv";
config();
import { join } from 'path';
import morgan from "morgan";
// Boop application imports
import { webhook } from './app/webhook.js'
import { activeProjects, projectSelector } from "./app/projects/index.js";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { projectsFolderPath } from "./app/constants.js";
import { BoopProject } from "./app/projects/project.js";
import { apiRouter } from "./api/api.router.js";
import { uiRouter } from "./ui/ui.router.js";
import { logger } from "./app/logger.js";
import { getArgValue } from "./utils.js";

// Port flag:
let port = process.env.PORT || 8004;
const argPort = getArgValue("--port");
if (argPort !== undefined) {
    let val = Number(argPort);
    if (Number.isNaN(val) === false) {
        port = val;
    }
}
// Secret flag:
const secret = getArgValue("--secret");
if (secret !== undefined) {
    process.env.SECRET = secret;
}
else {
    logger.warn("No SECRET variable set; Webhook will accept any request regardless of source. This means anyone can issue build requests to your server.");
}
//

app.use(express.json());
app.use(express.urlencoded());

app.use(morgan(
    ':method :url :status :remote-addr :res[content-length] - :response-time ms',
    {
        stream: {
            write: (message) => {
                logger.info(message.trim());
            },
        },
        skip(req, res) {
            // Skip UI router + project selector
            if (req.method === "GET")
                return true;
            if (req.originalUrl.startsWith("/boop/webhook"))
                return false;
            if (req.originalUrl.startsWith("/boop/api"))
                return false;
            return true;
        },
    }
));

// Webhook entry
app.post('/boop/webhook', webhook);

// API router
app.use('/boop/api', apiRouter);

app.use('/boop/', uiRouter);

// Entry point for all other requests, these either get ignored or forwarded to the project hosts
app.all('*', projectSelector);

// BOOP
app.listen(port, () => {
    if (existsSync(projectsFolderPath)) {
        const items = readdirSync(projectsFolderPath, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
        for (const projectDir of items) {
            // Start project
            const projectFilePath = join(projectsFolderPath, projectDir, "project.json");
            if (existsSync(projectFilePath)) {
                const projectName = projectDir;
                const project = new BoopProject(projectName);
                project.start().then(() => {
                    activeProjects.push(project);
                }).catch(err => {
                    logger.error(`Project startup ${project.name} failed (${err}).`);
                });
            }
        }
    }
    else {
        mkdirSync(projectsFolderPath);
    }
    logger.info(`------ Boop listening on port ${port} ------`);
});

const shutDownHandler = (crash?: boolean) => { 
    logger.info("------------ Boop shutting down ------------");
    for (const project of activeProjects) {
        if (project.process) {
            project.process.kill();
        }
        logger.info(`${project.name} disposed.`);
    }
    logger.info("-------------- Boop shut down --------------");
    if (crash !== true) {
        process.exit(0);
    }
};

process.once('SIGINT', shutDownHandler);

process.once('uncaughtException', (err) => {
    logger.error(`------------------ FATAL ------------------`);
    logger.error(`FATAL: ${err.message}${err.cause ? ` (cause: ${err.cause})` : undefined}`);
    logger.error(`FATAL: ${err.stack}`);
    shutDownHandler(true);
    process.exit(1);
});