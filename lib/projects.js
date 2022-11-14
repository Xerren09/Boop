const path = require('path');
const fs = require('fs');
const host = require('./host');
const directories = require('./directories');

const configFileName = "boop.config.json";

const projects = {
    instances: []
}

/**
 * Returns the list of projects hosted by Boop
 * @returns {object[]}
 */
function list () {
    const list = projects.instances.map(({ router, ...item }) => item);
    return list;
}

/**
 * Adds a new project to the registry
 * @param {*} webhookEvent The Webhook Event that triggered the flow
 * @param {*} port Port where the hosted app is running. Leave undefined or nul if there is none
 * @param {*} config Project configuration
 * @param {*} flow Project execution flow logs
 */
function add(webhookEvent, port, config, flow={}) {
    const checkIfProjectExistsIndex = projects.instances.findIndex(element => element.name == webhookEvent.repository.name);
    if (checkIfProjectExistsIndex != -1)
    {
        projects.instances.splice(checkIfProjectExistsIndex, 1);
    }
    const projectPath = path.join(directories.projectsFolderPath, webhookEvent.repository.name);
    let router;
    try
    {
        const targetPath = path.join(projectPath, config.main);
        fs.accessSync(targetPath, fs.constants.R_OK | fs.constants.W_OK);
        router = host.createWebsiteHost(webhookEvent.repository.name, targetPath, projectPath);
    }
    catch (err)
    {
        router = host.createProxyHost(webhookEvent.repository.name, `http://localhost:${port}`);
    }
    const project = {
        path: projectPath,
        config: config,
        name: webhookEvent.repository.name,
        route: `/${webhookEvent.repository.name}/`,
        router: router,
        port: port,
        repository: webhookEvent.repository,
        lastEvent: webhookEvent,
        flow: flow
    };
    projects.instances.push(project);
    writeInternalConfigFile(project);
}

/**
 * Saves the project data into a config file at `directories.projectsSettingsFolderPath`
 * @param {object} project Project instance
 */
function writeInternalConfigFile (project) {
    const dataContents = (({ router, ...element }) => element)(project);
    fs.writeFileSync(path.join(directories.projectsSettingsFolderPath, `${project.name}.json`), JSON.stringify(dataContents, null, "\t"));
}

/**
 * Loads in the configuration file from the repository if there is one, otherwise returns `undefined`
 * @param {string} repositoryPath Filepath of the project (`./projects/<project_name>`)
 * @returns 
 */
function checkConfig (repositoryPath) {
    const repositoryConfigPath = path.join(repositoryPath, configFileName);
    try
    {
        fs.accessSync(repositoryConfigPath, fs.constants.R_OK | fs.constants.W_OK);
        const config = JSON.parse(fs.readFileSync(repositoryConfigPath));
        return config;
    }
    catch (err)
    {
        return undefined;
    }
}

/**
 * Gets the project instance
 * @param {string} repositoryName Name of the project
 * @returns 
 */
function get(repositoryName) {
    const project = projects.instances.find(element => element.name === repositoryName);
    return project;
}

/**
 * Updates the execution flow log with new data, then saves it
 * @param {string} repositoryName Name of the project@param {string} repositoryName Name of the project
 * @param {*} flow 
 */
function updateFlow(repositoryName, flow) {
    const projectIndex = projects.instances.findIndex(element => element.name === repositoryName);
    const newFlow = {...projects.instances[projectIndex].flow, ...flow}
    projects.instances[projectIndex].flow = newFlow;
    writeInternalConfigFile(projects.instances[projectIndex]);
}

module.exports = {
    get,
    add,
    list,
    checkConfig,
    updateFlow
};