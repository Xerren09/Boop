require('dotenv').config();
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const app = express();
app.use(morgan());
app.use(express.json({
    verify: (req, res, buf, encoding) => {
        /*
        This is required for the GitHub signature check, if the request body is converted by the middleware,
        and then passed back to string through JSON.stringify(), the hashes don't match for some reason.
        Having the original raw body is the only way to properly verify if the webhook event came from GitHub.  
        */
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || 'utf8');
        }
    },
}));
const port = process.env.PORT || 8004;
// Tiny html view engine to make things a wee bit easier. It's cute, so it fits!
const sprightly = require('sprightly');
app.engine('spy', sprightly);
app.set('views', './web/client/index');
app.set('view engine', 'spy');
// Load in app resources
const system = require('./lib/system');
const webhook = require('./lib/webhook');
const projects = require('./lib/projects');
// Entry point for all other requests, these either get ignored or forwarded to the project hosts
app.all('*', function(req, res, next) {
    const projectName = req.url.split("/")[1];
    const project = projects.get(projectName);
    if (project)
    {
        // Forward to project host
        project.router(req, res, next);
    }
    else
    {
        // Jump to next handler
        next();
    }
});
//
app.use(express.static(path.join(__dirname, 'web', 'client', 'index')));
// Get Boop!'s frontpage
app.get('/', function(req, res) {
    const domain = `${req.protocol}://${req.get('Host')}`;
    const sysinfo = system.compile();
    const projectList = JSON.stringify(projects.list());
    res.status(200).render('index.spy', { nodeVersion: sysinfo.nodeVersion, nodeEnv: process.env.NODE_ENV, domain: domain, platform: sysinfo.platform, uptimeString: sysinfo.uptime.string, uptimeStart: sysinfo.uptime.start, projects: projectList});
});
// Entry point for webhooks, direct every webhook event here
app.post('/build/webhook', function(req, res) {
    webhook.run(req).then((result)=>{
        res.status(result.code).json({
            status: "success",
            content: result
        });
    }).catch((result)=>{
        res.status(result.code).json({
            status: "fail",
            content: result
        });
    });
});
// Get the details of a hosted project
app.get('/build/*', function(req, res) {
    const projectName = req.url.split("/")[2];
    const project = projects.get(projectName);
    const domain = `${req.protocol}://${req.get('Host')}`;
    res.status(200).render('project.spy', { project: JSON.stringify(project), projectName: project.name.charAt(0).toUpperCase() + project.name.slice(1), domain: domain });
});
// Catch 404 errors
app.use(function (req, res, next) {
    const error404resource = req.protocol + '://' + req.get('Host') + req.url;
    const serverDomain = req.get('Host');
    res.status(404).render('404.spy', { error404resource: error404resource, domain: serverDomain});
});

app.listen(port, () => {
    // Loads projects that have already been downloaded in case of a restart.
    system.reload();
    console.log(`Boop! build server running on port ${port}.`);
});