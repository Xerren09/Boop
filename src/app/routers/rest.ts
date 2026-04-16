import express from 'express';
import expressWs from "express-ws";
import morgan from "morgan";
import logger from "../../logger.js";
import { webhookHandler } from "../webhook.js";
import { apiRouter } from "./api.router.js";
import { projectSelector } from "./selector.js";
import { uiRouter } from "./ui.router.js";

export const server = express();
expressWs(server);
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
// Web interface router
server.use('/boop/', uiRouter);
// Entry point for all other requests, these either get ignored or forwarded to the project hosts
server.all('/{*splat}', projectSelector);