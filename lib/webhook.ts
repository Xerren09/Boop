import * as crypto from "crypto";
import { installProject } from './install/flow';
import { getProject } from './projects';
import * as express from "express";

/**
 * Parses the Webhook event, then installs and runs the application.
 * @param req 
 * @param res 
 * @returns 
 */
export async function webhook(req: express.Request, res: express.Response) {
    if (isSignatureValid(req)) {
        const webhookEvent = getWebhookEventDetails(req);
        //
        console.log(`Incoming webhook event from ${webhookEvent.repository.url}.`);
        //
        const project = getProject(webhookEvent.repository.name);
        if (project && project.isInstalling == false) {
            if ((webhookEvent.name == "ping") || (project.config?.branch == webhookEvent.repository.branch)) {
                // Update project
                installProject(webhookEvent);
                res.status(202).send(`Build started. Check ${req.host}/boop/projects/${webhookEvent.repository.name} for details.`);
            }
            else {
                console.warn(`Event branch was not ${project.config?.branch}; not processing.`);
                res.status(202).send(`Event branch was not ${project.config?.branch}; not processing.`);
                return;
            }
        }
        else if (project?.isInstalling == true) {
            // Project is installing, block update
            // TODO: queue update until the current installation is done. Overwrite with newest, if any.
            res.status(503).send(`This project is currently building a previous commit. Check ${req.host}/boop/projects/${webhookEvent.repository.name} for details, and try resending this event later.`);
        }
        else {
            // Project doesn't exist yet, install it.
            installProject(webhookEvent);
            res.status(202).send(`Build started. Check ${req.host}/boop/projects/${webhookEvent.repository.name} for details.`);
        }
    }
    else {
        res.status(401).send(`Unauthorized, signature invalid.`);
        return;
    }
}

/**
 * Returns a WebhookEvent object, which contains all of the relevant event info.
 * @param {express.Request} req Express Request object
 * @returns {WebhookEvent}
 */
export function getWebhookEventDetails(req: express.Request): WebhookEvent {
    const branchName = req.body.base_ref ? req.body.base_ref.split("refs/heads/")[1] : null;

    const webhookEvent: WebhookEvent = {
        name: req.get('X-GitHub-Event') || "",  // "ping"
        time: {
            unix: Date.now(),
            string: new Date(Date.now()).toUTCString()
        },
        repository: {
            url: req.body.repository.html_url,  // "https://github.com/Codertocat/Hello-World"
            branch: branchName,  // "refs/heads/main" -> main
            name: req.body.repository.name,  // "Hello-World"
            owner: {
                name: req.body.repository.owner.login,  // "Codertocat"
                url: req.body.repository.owner.html_url  // "https://github.com/Codertocat"
            },
        },
        security: {
            hash: req.get('X-Hub-Signature-256') || "",
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
 * @returns {boolean} True if valid, False if not.
 * */
function isSignatureValid(req: express.Request): boolean {
    const signatureHeader: string = req.get('X-Hub-Signature-256') || "";
    if (signatureHeader.length != 0) {
        const signature = Buffer.from(signatureHeader, 'utf8');
        const hmac = crypto.createHmac("sha256", process.env.SECRET || "");
        const messageDigest = Buffer.from("sha256" + '=' + hmac.update(req.rawBody).digest('hex'), 'utf8')
        if (crypto.timingSafeEqual(messageDigest, signature)) {
            return true;
        }
        else if (process.env.NODE_ENV == "development") {
            // Ignore the security when in development mode.
            return true;
        }
    }
    return false;
}