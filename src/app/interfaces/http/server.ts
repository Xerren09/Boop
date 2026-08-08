import express from 'express';
import morgan from "morgan";
import cors from "cors";
import { createServer } from "http";
import logger from "../../../logger.js";
import { webhookHandler } from "../../webhook.js";
import { apiRouter } from "./api.router.js";
import { wsRouter } from './ws/ws.router.js';
import { projectSelector } from "./selector.js";
import { uiRouter } from "./ui.router.js";
import { pathExists } from '../../utilities.js';
import { join } from 'path';
import { WEB_INTERFACE_DIR } from '../../constants.js';
import { once } from 'events';

async function createExpressServer() {
    const server = express();
    server.use(cors());
    server.use(express.json());
    server.use(express.urlencoded());
    server.use(morgan(
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
    server.post('/boop/webhook', webhookHandler);
    // API router
    server.use('/boop/api', apiRouter);
    if (await pathExists(join(WEB_INTERFACE_DIR, "index.html"))) {
        // WebUI router
        server.use('/boop/', uiRouter);
    }
    // Entry point for all other requests, these either get ignored or forwarded to the project hosts
    server.all('/{*splat}', projectSelector);
    return server;
}

/**
 * Creates a new pre-configured express instance and starts the HTTP server at the given port.
 * @param port 
 * @returns 
 */
export async function createHTTPServer(port: number) {
    const expressInstance = await createExpressServer();
    const server = createServer(expressInstance).listen(port);
    await once(server, "listening");
    // Configure websocket routers
    server.on("upgrade", (req, socket, head) => {
        const handled = wsRouter.handleUpgrade(req, socket, head);
        if (handled === false) {
            socket.destroy();
        }
    });
    return server;
}