import { config as dotenvConfig } from "dotenv";
dotenvConfig();
import * as path from 'path';
import express from 'express';
//const morgan = require('morgan');
const app = express();
//app.use(morgan());
// Tiny html view engine to make things a wee bit easier. It's cute, so it fits!
import sprightly from "sprightly"
// Load in app resources
import * as system from './lib/system'
import { webhook } from './lib/webhook'
import { getInternalProjectConfig, getProject, listProjects, projectSelector } from './lib/projects';
import { startBoop } from "./lib/startup";

app.use(express.json({
    verify: (req, res, buf, encoding) => {
        /*
        This is required for the GitHub signature check, if the request body is converted by the middleware,
        and then passed back to string through JSON.stringify(), the hashes don't match for some reason.
        Having the original raw body is the only way to properly verify if the webhook event came from GitHub.  
        */
        if (buf && buf.length) {
            req.rawBody = buf.toString('utf8');
        }
    },
}));

app.engine('spy', sprightly);
app.set('views', './web/client');
app.set('view engine', 'spy');

// Entry point for all other requests, these either get ignored or forwarded to the project hosts
app.all('*', projectSelector);

app.use(express.static(path.join(__dirname, 'web', 'client')));

// Get Boop!'s frontpage
app.get('/', function (req, res) {
    const domain = `${req.protocol}://${req.get('Host')}`;
    const sysinfo = system.compile();
    const projectList = JSON.stringify(listProjects());
    res.status(200).render('index/index.spy', {
        nodeVersion: sysinfo.nodeVersion,
        nodeEnv: process.env.NODE_ENV,
        domain: domain,
        platform: sysinfo.platform,
        uptimeString: sysinfo.uptime.string,
        uptimeStart: sysinfo.uptime.start,
        projects: projectList
    });
});

// Entry point for webhooks, direct every webhook event here
app.post('/boop/webhook', webhook);

// Get the details of a hosted project
app.get('/boop/projects/*', function (req, res, next) {
    const projectName = req.url.split("/")[3];
    const project = getProject(projectName);
    if (project) {
        const projectData = getInternalProjectConfig(projectName);
        res.status(200).render('project/project.spy', { project: JSON.stringify(projectData), projectName: project.name });
    }
    else {
        next();
    }
});

// Catch 404 errors
app.use(function (req, res, next) {
    const error404resource = req.protocol + '://' + req.get('Host') + req.url;
    const serverDomain = req.get('Host');
    res.status(404).render('404/404.spy', { error404resource: error404resource, domain: serverDomain });
});

// BOOP
const port = process.env.PORT || 8004;

app.listen(port, () => {
    // Loads projects that have already been downloaded in case of a restart.
    startBoop();
    console.log(`Boop! server running on port ${port}.`);
});