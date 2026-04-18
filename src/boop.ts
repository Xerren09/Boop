#!/usr/bin/env node
import { styleText, parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { config } from "dotenv";
config({ quiet: true });
// Boop application imports
import Manager from './app/project/manager.js';
import logger from './logger.js';
import { checkGitAvailable } from './app/shell/git.js';
import { ENV_DISABLE_WEBHOOK_SECURITY, ENV_PORT, ENV_PORT_KEY, ENV_SECRET, ENV_SECRET_KEY, WEB_INTERFACE_DIR } from './constants.js';
// Interfaces
import { cli } from './app/interfaces/cli.js';
import { server } from './app/interfaces/http/rest.js';
import { once } from 'node:events';
import { pathExists } from './app/utilities.js';
import { join } from 'node:path';

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


// BOOP!
const BOOP = server.listen(port, async () => { 
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
    if (await pathExists(join(WEB_INTERFACE_DIR, "index.html"))) {
        console.log(`Web interface available at`, styleText("blueBright", `http://localhost:${port}/boop/`));
    }
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
    cli.prompt();
    const abortHandler = new AbortController();
    try {
        await Promise.race([
            once(cli, "close", {signal: abortHandler.signal}),
            once(process, "SIGINT", {signal: abortHandler.signal}),
            once(process, "SIGTERM", {signal: abortHandler.signal}),
            once(process, "uncaughtException", { signal: abortHandler.signal }),
            once(process, "unhandledRejection", { signal: abortHandler.signal }),
        ]);
    }
    catch (e) {
        if (e instanceof Error) {
            logger.logException(e);
            process.exitCode = 1;
        }
    }
    finally {
        abortHandler.abort("exiting");
        await handle_termination();
    }
});

async function handle_termination() {
    console.info("\n====\nPreparing to shut down...");
    try {
        await Manager.Dispose();
    }
    catch (err) {
        logger.logException(err);
        logger.warn("Not all project shut down. This might mean some processes will be left alive after Boop shuts down...");
    }
    logger.end();
    await Promise.all([
        once(logger, "finish"),
    ]);
    BOOP.close();
    cli.close();
    console.info("Boop going to rest...");
    process.exit(process.exitCode);
}