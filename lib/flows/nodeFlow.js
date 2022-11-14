const shell = require('../shell');
const path = require('path');
const projects = require('../projects');
const host = require('../host');
const directories = require('../directories');
const fs = require('fs');

function prettyLog(arr) {
    
}

function run(webhookEvent) {
    return new Promise((resolve, reject) => {
        const repositoryPath = path.join(directories.projectsFolderPath, webhookEvent.repository.name);
        let flowSteps = {
            start: new Date(Date.now()).toUTCString(),
            clone: null,
            configCheck: null,
            run: null,
            main: null
        };
        // 1. Clone repo
        shell.getRepository(webhookEvent.repository.url, webhookEvent.repository.name).then((cloneResult)=>{
            flowSteps.clone = cloneResult;
            const config = projects.checkConfig(repositoryPath);
            if (config)
            {
                flowSteps.configCheck = config;
                // 3. Run configuration
                shell.executeCommands(config.run, repositoryPath).then((execResult)=>{
                    flowSteps.run = execResult;
                    host.getFreePort((port)=>{ 
                        // Check if config.main is a path or command
                        try
                        {
                            const targetPath = path.join(repositoryPath, config.main);
                            fs.accessSync(targetPath, fs.constants.R_OK | fs.constants.W_OK);
                            // config.main is a path
                            flowSteps.main = {
                                command: config.main,
                                output: [`File path: ${targetPath}`, `Hosted at URL: /${webhookEvent.repository.name}/`],
                                error: [],
                                exitCode: 0
                            };
                            // 4. Create an instance
                            projects.add(webhookEvent, port, config, flowSteps);
                            resolve(flowSteps);
                        }
                        catch (err)
                        {
                            // config.main is a command
                            // 3.5 Run application
                            shell.runApp(config.main, port, repositoryPath, (startFlow)=>{
                                // First callback only return the command ran
                                flowSteps.main = startFlow;
                                // 4. Create an instance
                                projects.add(webhookEvent, port, config, flowSteps);
                                resolve(flowSteps);
                            }, (exitFlow)=>{
                                flowSteps.main = exitFlow;
                                projects.updateFlow(webhookEvent.repository.name, flowSteps);
                            });
                        }
                    });
                }).catch(execErrResult=>{
                    flowSteps.run = execErrResult;
                    reject(flowSteps);
                });
            }
            else
            {
                // no config; return error
                flowSteps.configCheck = "No valid configuration file could be found. Please check if you have a proper configuration file present in the repository.";
                reject(flowSteps);
            }
        }).catch(cloneErrResult => {
            flowSteps.clone = cloneErrResult;
            reject(flowSteps);
        });
    });
};

function restart(project) {
    host.getFreePort((port)=>{ 
        try
        {
            const targetPath = path.join(project.path, project.config.main);
            fs.accessSync(targetPath, fs.constants.R_OK | fs.constants.W_OK);
            project.flow.main = {
                command: project.config.main,
                output: [`File path: ${targetPath}`, `Hosted at URL: /${project.name}/`],
                error: [],
                exitCode: 0
            };
            // 4. Create an instance
            projects.add(project.lastEvent, port, project.config, project.flow);   
        }
        catch (err)
        {
            // config.main is a command
            // 3.5 Run application
            shell.runApp(project.config.main, port, project.path, (startFlow)=>{
                // First callback only return the command ran
                project.flow.main = startFlow;
                // 4. Create an instance
                projects.add(project.lastEvent, port, project.config, project.flow);
            }, (exitFlow)=>{
                project.flow.main = exitFlow;
                projects.updateFlow(project.name, project.flow);
            });
        }
    });
}

module.exports = {
    run,
    restart
};