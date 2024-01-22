import * as crypto from "crypto";
import * as express from "express";
import { BoopProject } from "./projects/project.js";
import { activeProjects } from "./projects/index.js";
import { logger } from "./logger.js";
import { INVALID_WEBHOOK_SIGNATURE, NOT_A_WEBHOOK } from "./constants.js";

/**
 * Handles the Webhook event, then installs and runs the application.
 * @param req 
 * @param res 
 * @returns 
 */
export async function webhook(req: express.Request, res: express.Response) {
    if (req.get('X-GitHub-Event') !== undefined) {
        if (isSignatureValid(req)) {
            const webhookEvent = getWebhookEventDetails(req);
            //
            logger.info(`Incoming webhook event from ${webhookEvent.repository.url}.`);
            //
            let project = activeProjects.find(el => el.name == webhookEvent.repository.name);
            if (project) {
                project.onWebhookEvent(webhookEvent);
                const message = `Webhook event accepted. Build added to queue. If a build is already in progress, this build will be started after it is complete. This event may be skipped if multiple events are received at the same time while busy, and only the last received event in the queue will be processed. Check ${res.req.hostname}/boop/projects/${webhookEvent.repository.name} for details.`;
                res.status(202).send(message);
            }
            else {
                // Project doesn't yet exists on this machine; create it
                logger.info(`First time setup started for ${webhookEvent.repository.name}.`);
                BoopProject.createProject(webhookEvent);
                res.status(202).send(`Webhook event accepted. Check ${req.hostname}/boop/projects/${webhookEvent.repository.name} for more details.`);
            }
        }
        else {
            logger.error(INVALID_WEBHOOK_SIGNATURE);
            res.status(401).send(INVALID_WEBHOOK_SIGNATURE);
        }
    }
    else {
        logger.error(NOT_A_WEBHOOK);
        res.status(400).send(NOT_A_WEBHOOK);
    }
}

/**
 * Returns a WebhookEvent object, which contains all of the relevant event info.
 * @param {express.Request} req Express Request object
 * @returns {WebhookEvent}
 */
export function getWebhookEventDetails(req: express.Request): WebhookEvent {
    const webhookEvent: WebhookEvent = {
        type: req.get('X-GitHub-Event') || "",
        time: Date.now(),
        repository: {
            url: req.body.repository.html_url,  // "https://github.com/Codertocat/Hello-World"
            branch: req.body.ref  ? req.body.ref .split("refs/heads/")[1] : null,  // "refs/heads/main" -> main
            name: req.body.repository.name,  // "Hello-World" -- this is file system safe!
            owner: {
                name: req.body.repository.owner.login,  // "Codertocat"
                url: req.body.repository.owner.html_url  // "https://github.com/Codertocat"
            },
        },
        commit: {
            id: req.body.head_commit?.id || null,
            url: req.body.head_commit?.url || null
        },
        security: {
            hash: req.get('X-Hub-Signature-256') || null,
            valid: isSignatureValid(req)
        },
        sender: {
            name: req.body.sender.login,  // "Codertocat"
            url: req.body.sender.html_url  // "https://github.com/Codertocat"
        }
    }
    return webhookEvent;
}

/**
 * Check whether or not the request's signature is valid.
 * How it works:
 * https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks
 * @param {express.Request} req Express Request object
 * @returns {boolean}
 * */
function isSignatureValid(req: express.Request): boolean {
    const signatureHash: string = req.get('X-Hub-Signature-256') || "";
    // Discard message if there is no signature
    if (process.env.NODE_ENV != "development") {
        if (signatureHash.length != 0) {
            const body: string = JSON.stringify(req.body);
            const WEBHOOK_SECRET = process.env.SECRET || "";
            const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
            const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
            const untrusted =  Buffer.from(req.get("x-hub-signature-256"), 'ascii');
            return crypto.timingSafeEqual(trusted, untrusted);
        }
    }
    else {
        // Ignore security in development mode
        return true;
    }
    return false;
}

export interface WebhookEvent {
    type: string;  // "ping"
    time: number,
    repository: {
        url: string;
        branch: string | null;
        name: string;
        owner: {
            name: string;
            url: string;
        },
    },
    commit: {
        id: string | null;
        url: string | null;
    },
    security: {
        hash: string | null;
        valid: boolean;
    },
    sender: {
        name: string;
        url: string;
    }
}