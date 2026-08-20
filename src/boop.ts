#!/usr/bin/env node
import { styleText, parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { once } from 'node:events';
import { pathExists } from './app/utilities.js';
import { join } from 'node:path';
import { WEB_INTERFACE_DIR } from './app/constants.js';
import { BOOP_DISABLE_WEBHOOK_SECURITY, BOOP_PORT, BOOP_SECRET } from './app/settings.js';
// Boop application imports
import Manager from './app/project/manager.js';
import logger from './app/log.js';
import { checkGitAvailable } from './app/shell/git.js';
// Interfaces
import { createCLI } from './app/interfaces/cli/cli.js';
import { createHTTPServer } from './app/interfaces/http/server.js';

async function BOOP() {
    //
    if (await checkGitAvailable() == false)
    {
        // Consider this a fatal error since nothing works without git
        throw new Error("Git is not available, but Boop needs it to work. Install git and try again.");
    }
    //
    const port = BOOP_PORT;
    console.log(`                         __ `);
    console.log(` _____ _____ _____ _____|  |`);
    console.log(`| __  |     |     |  _  |  |`);
    console.log(`| __ -|  |  |  |  |   __|__|`);
    console.log(`|_____|_____|_____|__|  |__|`);
    console.log(`Tiny CI/CD server for GitHub webhooks!\n`);
    // Use a stack to auto dispose of everything in order; get rid of the logger last
    await using stack = new AsyncDisposableStack();
    stack.adopt(logger, async () => { logger.end(); await once(logger, "finish") });
    const cli = stack.use(createCLI());
    try {
        stack.use(await createHTTPServer(port));
        // App info stuff
        console.log(`====`);
        console.log(`Boop listening on port`, styleText("blueBright", `${port}`));
        console.log(`Webhook listener available at`, styleText("blueBright", `http://localhost:${port}/boop/webhook`));
        if (await pathExists(join(WEB_INTERFACE_DIR, "index.html"))) {
            console.log(`Web interface available at`, styleText("blueBright", `http://localhost:${port}/boop/`));
        }
        else {
            console.warn(`Web interface not installed.`);
        }
        // ENV warnings
        if (BOOP_DISABLE_WEBHOOK_SECURITY) {
            logger.warn("Webhook security disabled; Webhook will accept any request regardless of source. This means anyone can issue build requests to your server.");
        }
        else if (BOOP_SECRET == "") {
            logger.warn("No SECRET variable set; Webhook will not accept any events. Use 'DISABLE_WEBHOOK_SECURITY' environment variable to allow webhooks without a secret set.");
        }
        console.log(`====\n`);
    }
    catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
            logger.error("HTTP server port already taken.", { port: port });
        }
        // A fault here is fatal; rethrow
        throw err;
    }
    // Catch and log Load and Deploy exceptions so other functional projects can still run
    try {
        await Manager.LoadAll();
        console.log("Projects loaded.");
    }
    catch (err) {
        logger.logException(err);
    }
    try {
        await Manager.DeployAll();
        console.log("Projects deployed.");
    }
    catch (err) {
        logger.logException(err);
    }
    console.log("\n====");
    cli.prompt();
    // Wait for CLI exit or other termination signal
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
    }
    console.info("\n====\nPreparing to shut down...");
    // Manually dispose of Manager so we can keep a log of any dispose errors. 
    // The other diposables are interfaces that we don't care about if they error out, they won't cause issues and get cleaned up by Node when the process exits.
    try {
        await Manager[Symbol.asyncDispose]();
    }
    catch (err) {
        logger.logException(err);
        process.exitCode = 1;
    }
    console.info("Boop going to rest...");
}

BOOP();