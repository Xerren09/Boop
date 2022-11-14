const path = require('path');
const fs = require('fs');
const directories = require('./directories');
const nodeFlow = require('./flows/nodeFlow');

function upTime () {
    const processUptime = process.uptime();
    const processUptimeMS = process.uptime()*1000;
    const currDate = Date.now();
    const processStartDate = new Date((currDate-processUptimeMS));
    return {
        ms: Math.floor(processUptimeMS),
        string: `${Math.floor(processUptime/86400)} days ${Math.floor(processUptime/3600)%24} hours ${Math.floor(processUptime/60)%60} minutes ${Math.floor(processUptime%60)} seconds`,
        start: processStartDate.toUTCString()
    }
}

function getPlatform () {
    var platform = process.platform;
    if (platform === 'win32')
    {
        platform = 'windows';
    }
    else if (platform === 'darwin')
    {
        platform = 'macos'; // Why the hell even
    }
    else
    {
        platform = `unix - ${platform}`;
    }
    return platform;
}

function getNodeVersion () {
    const nodeVersion = process.version;
    return nodeVersion;
}

function compile () {
    return {
        uptime: upTime(),
        platform: getPlatform(),
        nodeVersion: getNodeVersion()
    }
}

function reload() {
    fs.readdirSync(directories.projectsSettingsFolderPath).forEach(element => {
        const project = JSON.parse(fs.readFileSync(path.join(directories.projectsSettingsFolderPath, element)));
        try
        {
            fs.accessSync(project.path, fs.constants.R_OK | fs.constants.W_OK);
            nodeFlow.restart(project);
        }
        catch (err)
        {
            // Ignore projects that have an internal cofiguration file, but no repository configuration;
            // they have been most likely deleted, or are a failed install.
        }
    });
}

module.exports = {
    compile,
    getNodeVersion,
    getPlatform,
    reload
};