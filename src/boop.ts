#!/usr/bin/env node
import { styleText, parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import express from 'express';
import expressWs from "express-ws";
import { config } from "dotenv";
config({ quiet: true });
import morgan from "morgan";
// Boop application imports
import Manager from './app/project/manager.js';
import logger from './logger.js';
import { webhookHandler } from './app/webhook.js';
import { uiRouter } from './app/routers/ui.router.js';
import { apiRouter } from './app/routers/api.router.js';
import { projectSelector } from './app/routers/selector.js';
import { checkGitAvailable } from './app/shell/git.js';
import { ENV_DISABLE_WEBHOOK_SECURITY, ENV_PORT, ENV_PORT_KEY, ENV_SECRET, ENV_SECRET_KEY } from './constants.js';
import { cli } from './cli.js';

const boopArgsOptions: ParseArgsOptionsConfig = {
    port: {
        type: 'string',
    },
    secret: {
        type: 'string',
    },
};
const args = parseArgs({ options: boopArgsOptions });

try {
    await checkGitAvailable();
}
catch {
    // Consider this a fatal error since nothing works without git
    throw new Error("Git is not available, but Boop needs it to work. Install git and try again.");
}
// Port flag:
const port = ((Number((args.values.port as string)) || null) ?? ENV_PORT ?? 8004);
process.env[ENV_PORT_KEY] = `${port}`;
// Secret flag:
const secret = args.values.secret ?? ENV_SECRET ?? "";
process.env[ENV_SECRET_KEY] = `${secret}`
const app = express();
expressWs(app);
app.use(express.json());
app.use(express.urlencoded());
app.use(morgan(
    ':method :url :status :remote-addr',
    {
        stream: {
            write: (message) => {
                logger.info(message.trim());
            },
        },
        skip(req, _res) {
            // Only log webhook events.
            if ((req.method === "POST") && (req.originalUrl.startsWith("/boop/webhook"))) {
                return false;
            }
            return true;
        },
    }
));
// Webhook entry
app.post('/boop/webhook', webhookHandler);
// API router
app.use('/boop/api', apiRouter);
// Web interface router
app.use('/boop/', uiRouter);
// Entry point for all other requests, these either get ignored or forwarded to the project hosts
app.all('/{*splat}', projectSelector);


// BOOP!
const BOOP = app.listen(port, async () => { 
    console.log(`                         __ `);
    console.log(` _____ _____ _____ _____|  |`);
    console.log(`| __  |     |     |  _  |  |`);
    console.log(`| __ -|  |  |  |  |   __|__|`);
    console.log(`|_____|_____|_____|__|  |__|`);
    console.log(`Tiny CI/CD server for GitHub webhooks!\n`);
    if (ENV_DISABLE_WEBHOOK_SECURITY) {
        logger.warn("Webhook security disabled; Webhook will accept any request regardless of source. This means anyone can issue build requests to your server.");
    }
    else if (secret == "") {
        logger.warn("No SECRET variable set; Webhook will not accept any events. Use 'DISABLE_WEBHOOK_SECURITY' environment variable to allow webhooks without a secret set.");
    }
    console.log(`====`);
    console.log(`Boop listening on port`, styleText("blueBright", `${port}`));
    console.log(`Webhook listener available at`, styleText("blueBright", `http://localhost:${port}/boop/webhook`));
    // TODO: check if web is compiled
    console.log(`Web interface available at`, styleText("blueBright", `http://localhost:${port}/boop/`));
    console.log(`====\n`);
    try {
        await Manager.LoadAll();
    }
    catch (err) {
        logger.logException(err);
    }
    try {
        await Manager.DeployAll();
    }
    catch (err) {
        logger.logException(err);
    }
    cli.once("close", () => {
        handle_termination();
    });
    cli.prompt();
});

async function handle_termination() {
    console.log(`\n====`);
    console.info("Preparing to shut down...");
    try {
        await Manager.StopAll();
    }
    catch (err) {
        logger.logException(err);
        logger.warn("Not all project shut down. This might mean some processes will be left alive after Boop shuts down...");
    }
    logger.on('finish', (info) => {
        BOOP.close();
        process.exit(process.exitCode);
    });
    logger.end();
    cli.close();
    console.info("Boop going to rest...");
}

process.once('SIGINT', handle_termination);
process.once('SIGTERM', handle_termination);

process.once('uncaughtException', async (err) => {
    logger.logException(err);
    process.exitCode = 1;
    await handle_termination();
});
