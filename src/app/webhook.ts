import * as crypto from "crypto";
import * as express from "express";
import ProjectManager from "./project/manager.js";
import { ENV_DISABLE_WEBHOOK_SECURITY, ENV_SECRET, INVALID_WEBHOOK_SIGNATURE, NOT_A_WEBHOOK } from "./constants.js";
import logger from "../logger.js";

/**
 * Handles the Webhook event, then installs and runs the application.
 * @param req 
 * @param res 
 * @returns 
 */
export async function webhookHandler(req: express.Request, res: express.Response) {
    if (req.get('X-GitHub-Event') !== undefined) {
        if (isSignatureValid(req)) {
            const webhookEvent = parseWebhookEvent(req);
            //
            logger.info(`Incoming webhook event from ${webhookEvent.repository.url}.`);
            //
            const project = ProjectManager.projects.find(el => el.name == webhookEvent.repository.name);
            if (project) {
                project.onWebhookEvent(webhookEvent, res);
            }
            else {
                // Project doesn't yet exists on this machine; create it
                logger.info(`First time setup started for ${webhookEvent.repository.name}.`);
                res.status(202).send(`Accepted, creating Boop project.`);
                ProjectManager.Create(webhookEvent.repository.name, webhookEvent.repository.url).then((fresh) => {
                    fresh.onWebhookEvent(webhookEvent);
                });
            }
        }
        else {
            logger.error(INVALID_WEBHOOK_SIGNATURE);
            res.status(401).send(INVALID_WEBHOOK_SIGNATURE);
        }
    }
    else {
        res.status(400).send(NOT_A_WEBHOOK);
    }
}

/**
 * Returns a WebhookEvent object, which contains all of the relevant event info.
 * @param {express.Request} req Express Request object
 * @returns {WebhookEvent}
 */
function parseWebhookEvent(req: express.Request): WebhookEvent {
    const webhookEvent: WebhookEvent = {
        type: req.get('X-GitHub-Event') || "",
        time: Date.now(),
        repository: {
            url: req.body.repository.html_url,  // "https://github.com/Codertocat/Hello-World"
            branch: req.body.ref  ? req.body.ref.split("refs/heads/")[1] : null,  // "refs/heads/main" -> main
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
 * 
 * If no `SECRET` environment variable is set, the function returns false. This can be 
 * overridden by setting the `DISABLE_WEBHOOK_SECURITY` variable to `"true"`
 * @param {express.Request} req Express Request object
 * @returns {boolean}
 * */
function isSignatureValid(req: express.Request): boolean {
    // Ignore security check
    if (process.env[ENV_DISABLE_WEBHOOK_SECURITY] == "true") {
        return true;
    }
    else {
        // If no SECRET is defined, we can't validate the signature, so reject it.
        if (!process.env[ENV_SECRET]) {
            return false;
        }
    }

    const signatureHash: string = req.get('X-Hub-Signature-256') ?? "";
    // Discard message if there is no signature
    if (signatureHash.length != 0) {
        const body: string = JSON.stringify(req.body);
        const WEBHOOK_SECRET = process.env[ENV_SECRET] || "";
        const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
        const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
        const untrusted =  Buffer.from(signatureHash, 'ascii');
        return crypto.timingSafeEqual(trusted, untrusted);
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