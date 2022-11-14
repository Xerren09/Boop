const crypto = require('crypto');
const nodeFlow = require('./flows/nodeFlow');
const getProject = require('./projects').get;

/**
 * Parses the Webhook event, then runs the NodeJS workflow
 * @param {Request} req Webhook event request
 * @returns 
 */
function run (req) {
    return new Promise((resolve, reject)=>{
        const webhookEvent = parse(req);
        if (webhookEvent.security.valid)
        {
            const project = getProject(webhookEvent.repository.name);
            if (webhookEvent.name == "ping" || project.config.branch == webhookEvent.repository.branch)
            {
                nodeFlow.run(webhookEvent).then((flow)=>{
                    resolve({
                        code: 200,
                        message: "Success.", 
                        event: webhookEvent,
                        flow: flow
                    });
                }).catch((flow)=>{
                    reject({
                        code: 500,
                        message: "Internal error. The flow execution encountered an error; see <flow> for details.", 
                        event: webhookEvent,
                        flow: flow
                    });
                });
            }
            else
            {
                reject({
                    code: 202,
                    message: "Branch excluded; request ignored.",
                    event: webhookEvent,
                    flow: null
                });
            }
        }
        else
        {
            reject({
                code: 403,
                message: "Forbidden.", 
                event: webhookEvent,
                flow: null
            });
        }
    });
}

/**
 * Returns a WebhookEvent object, parsed out of the incoming request body.
 * @param {Request} req Express Request object
 * @returns {WebhookEvent}
 */
function parse (req) {
    const branchName = req.body.base_ref ? req.body.base_ref.split("refs/heads/")[1] : null;
    const webhookEvent = {
        name: req.get('X-GitHub-Event'),  // "ping"
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
            hash: req.get('X-Hub-Signature-256'),
            valid: isWebhookSignatureValid(req)
        },
        sender: {
            name: req.body.sender.login,  // "Codertocat"
            url: req.body.sender.html_url  // "https://github.com/Codertocat"
        }
    }
    return webhookEvent;
}

/**
 * Check whether or not the request's signature is valid, to root out freeloaders >:c
 * How it works:
 * https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks
 * @param {Request} req 
 * @returns {boolean}
 */
function isWebhookSignatureValid (req) {
    const signature = Buffer.from(req.get('X-Hub-Signature-256'), 'utf8');
    const hmac = crypto.createHmac("sha256", process.env.SECRET);
    const messageDigest = Buffer.from("sha256" + '=' + hmac.update(req.rawBody).digest('hex'), 'utf8')
    if (signature.length !== messageDigest.length || !crypto.timingSafeEqual(messageDigest, signature)) 
    {
        if (process.env.NODE_ENV == "development")
        {
            // Ignore auth to allow proper testing. See app.js 's express.json explanation.
            return true;
        }
        else
        {
            return false;
        }
    }
    else
    {
        return true;
    }
}

module.exports = {
    run,
    parse,
};