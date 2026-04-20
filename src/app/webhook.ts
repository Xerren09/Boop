import * as crypto from "crypto";
import * as express from "express";
import ProjectManager from "./project/manager.js";
import { ENV_DISABLE_WEBHOOK_SECURITY, ENV_SECRET } from "../constants.js";
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
            logger.info(`Incoming webhook event from ${webhookEvent.repository.url}.`, {event: webhookEvent.id});
            //
            const project = ProjectManager.projects.find(el => el.name == webhookEvent.repository.name);
            if (project) {
                // Designed to not throw so no need to await try
                project.onWebhookEvent(webhookEvent, res);
            }
            else {
                // Project doesn't yet exists on this machine; create it
                logger.info(`First time setup started for '${webhookEvent.repository.name}'.`, {event: webhookEvent.id});
                res.status(202).send(`Accepted, creating Boop project.`);
                try {
                    const fresh = await ProjectManager.Create(webhookEvent.repository.url, webhookEvent.repository.branch);
                    fresh.onWebhookEvent(webhookEvent);
                }
                catch (err) {
                    // If Create throws we can't handle it any better than it already does on its own; catch and ignore the re-throw.
                    // This is because github only waits a few seconds for a webhook response, so we can only do immediate checks
                    // and a proper error return would probably be too drawn out before res gets dropped.
                    // See https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#respond-within-10-seconds
                }
            }
        }
        else {
            const err = "Unauthorized webhook request, signature invalid.";
            logger.error(err);
            res.status(401).send(err);
        }
    }
    else {
        res.status(400).send("Invalid.");
    }
}

/**
 * Returns a WebhookEvent object, which contains all of the relevant event info.
 * @param {express.Request} req Express Request object
 * @returns {WebhookEvent}
 */
function parseWebhookEvent(req: express.Request): WebhookEvent {
    const webhookEvent: WebhookEvent = {
        id: req.get('X-GitHub-Delivery') ?? "",
        type: req.get('X-GitHub-Event') ?? "",
        time: Date.now(),
        repository: {
            url: req.body.repository.html_url,  // "https://github.com/Codertocat/Hello-World"
            branch: req.body.ref ? req.body.ref.split("refs/heads/")[1] : null,  // "refs/heads/main" -> main
            name: req.body.repository.name,  // "Hello-World" -- this is file system safe!
            owner: {
                name: req.body.repository.owner.login,  // "Codertocat"
                url: req.body.repository.owner.html_url  // "https://github.com/Codertocat"
            },
        },
        commit: {
            id: req.body.head_commit?.id ?? null,
            url: req.body.head_commit?.url ?? null
        },
        security: {
            hash: req.get('X-Hub-Signature-256') ?? null,
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
    if (ENV_DISABLE_WEBHOOK_SECURITY) {
        return true;
    }
    else {
        // If no SECRET is defined, we can't validate the signature, so reject it.
        if (ENV_SECRET == undefined) {
            return false;
        }
    }

    const signatureHash: string = req.get('X-Hub-Signature-256') ?? "";
    // Discard message if there is no signature
    if (signatureHash.length != 0) {
        const body: string = JSON.stringify(req.body);
        const WEBHOOK_SECRET = ENV_SECRET ?? "";
        const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
        const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
        const untrusted =  Buffer.from(signatureHash, 'ascii');
        return crypto.timingSafeEqual(trusted, untrusted);
    }
    return false;
}

export interface WebhookEvent {
    /**
     * The unique ID of this event delivery. This will be the same for original *and* redeliveries as well.
     * 
     * Determined by the value of the `X-GitHub-Delivery` header.
     */
    id: string;
    /**
     * The type of the event, as configured on github. See {@link https://docs.github.com/en/webhooks/webhook-events-and-payloads|webhook events and payloads}.
     * 
     * Determined by the value of the `X-GitHub-Event` header.
     */
    type: string;  // "ping"
    /**
     * The time this event was reveived by Boop.
     */
    time: number,
    /**
     * Information about the source repository, including which branch triggered this event.
     */
    repository: {
        url: string;
        /**
         * The branch this event originates from. `null` if `ref` is not set in the event payload.
         */
        branch: string | null;
        name: string;
        owner: {
            name: string;
            url: string;
        },
    },
    /**
     * The commit that triggered this event.
     */
    commit: {
        id: string | null;
        url: string | null;
    },
    /**
     * Information about if the event is secure and originated from github.
     * 
     * If the payload's hash and the request hash don't match, `valid` will be false.
     */
    security: {
        /**
         * The value of the `X-Hub-Signature-256` header. Use a repository secret to ensure events are secure.
         */
        hash: string | null;
        valid: boolean;
    },
    /**
     * The user that triggered this event. Usually this is the same as the commit's user.
     */
    sender: {
        name: string;
        url: string;
    }
}