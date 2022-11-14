const shell = require('shelljs');
const fs = require('fs');
const path = require('path');
const directories = require('./directories');
/**
 * Clones or pulls a repository into `./projects/<repo_name>`
 * @param {string} gitHubURL GitHub url of the repository
 * @param {string} repositoryName Name of the repository (from webhook event)
 * @returns 
 */
function getRepository (gitHubURL, repositoryName) {
    return new Promise((resolve, reject) => {
        // Check if repository exists, clone if not, pull if yes
        let command = "";
        try
        {
            fs.accessSync(path.join(directories.projectsFolderPath, repositoryName), fs.constants.R_OK | fs.constants.W_OK);
            command = `git pull ${gitHubURL}`;
        }
        catch (err)
        {
            command = `git clone ${gitHubURL}`;
        }
        executeCommands([command], directories.projectsFolderPath).then((flow)=>{
            resolve(flow);
        }).catch((flow)=>{
            // Git throws an error if the repository folder already exists when cloning,
            // and also at "pull" if the repository is already up to date
            reject(flow);
        });
    });
}

/**
 * Synchronously executes an array of commands
 * @param {string[]} commands List of commands to run
 * @param {string} cwd Working directory for the commands
 * @returns 
 */
function executeCommands(commands=[], cwd) {
    return new Promise((resolve, reject) => {
        let flow = [];
        let commandFlow = {};
        for (let command of commands)
        {
            const cmd = shell.exec(command, {cwd: cwd});
            commandFlow = {
                command: command,
                output: cmd.stdout.toString().split(`\n`).filter(elem => elem != ""),
                error: cmd.stderr.toString().split(`\n`).filter(elem => elem != ""),
                exitCode: cmd.code
            };
            flow.push(commandFlow);
            if (commandFlow.exitCode != 0)
            {
                reject(flow);
            }
        }
        resolve(flow);
    });
}

/**
 * Starts a NodeJS app on a given port.
 * @param {*} command Command that starts the given app. Can be an npm script.
 * @param {*} port Port for the app
 * @param {*} cwd Working directory for the app
 * @param {*} callback 
 */
function runApp(command, port, cwd, startedCallback, exitCallback) {
    const platform = process.platform;
    if (platform == "win32")
    {
        command = `set PORT=${port}&& ${command}`;
    }
    else
    {
        command = `export PORT=${port}&& ${command}`;
    }
    //export PORT=${port} || set PORT=${port}&& ${command}
    shell.exec(command, {
        async: true,
        cwd: cwd
    }, (errCode, stdout, stderr)=>{
        let exitFlow = {
            command: command,
            output: stdout.toString().split(`\n`).filter(elem => elem != ""),
            error: stderr.toString().split(`\n`).filter(elem => elem != ""),
            exitCode: errCode
        }
        exitCallback(exitFlow);
    })
    startedCallback({
        command: command,
        output: [],
        error: [],
        exitCode: null
    });
}

module.exports = {
    getRepository,
    executeCommands,
    runApp
};