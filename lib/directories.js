const path = require('path');
/**
 * Path leading to the `projects` folder, where repositories are downloaded.
 */
const projectsFolderPath = path.join(process.cwd(), "/projects");
/**
 * Path leading to the `data` folder, where app configurations are stored.
 */
const projectsSettingsFolderPath = path.join(process.cwd(), "/data");

module.exports = {
    projectsFolderPath,
    projectsSettingsFolderPath
}