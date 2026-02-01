import { PROJECT_BIN_DIR_NAME, PROJECT_FILE_NAME, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, PROJECTS_DIR } from "../constants.js";
import { join } from "path";
import logger from "../../logger.js";
import { BoopProject, type ProjectConfig } from "./boop.project.js";
import { ServiceProject } from "./service.project.js";
import { mkdir, rm, writeFile, readdir } from "fs/promises";
import { pathExists } from "../utilities.js";
import { downloadRemote } from "../shell/git.js";
import { getWorkflowFile, parseWorkflow, WorkflowConfig } from "../workflow.js";
import { InstantiateProject } from "./instantiate.js";

class ProjectManager {
    private _projects: BoopProject[] = [];
    /**
     * The list of all loaded projects known to Boop.
     */
    public get projects() : readonly BoopProject[] {
        return this._projects;
    }

    public Find(target: string): BoopProject {
        return this.projects.find(el => el.name == target);
    }

    /**
     * Loads a project with the specified name.
     * @param projectName 
     */
    public async Load(projectName: string) {
        if (this._projects.find(el => el.name === projectName) != undefined) {
            logger.info(`Project '${projectName}' already loaded.`);
            return;
        }
        const projectFile = join(PROJECTS_DIR, projectName, PROJECT_FILE_NAME);
        if (await pathExists(projectFile) == false) {
            const err = new Error(`No project with name '${projectName}' exists.`);
            logger.error(err);
            throw err;
        }
        try {
            const project = await InstantiateProject(projectFile);
            this._projects.push(project);
            logger.info(`Loaded project '${project.name}'`);
        }
        catch (error) {
            logger.error(`Failed to load project '${projectName}'`, error);
        }
    }

    /**
     * Creates a new project.
     * @param name 
     * @param remote 
     * @returns 
     */
    public async Create(name: string, remote: string): Promise<BoopProject> {
        const projectDir = join(PROJECTS_DIR, name);
        if (await pathExists(join(projectDir, PROJECT_FILE_NAME))) {
            const err = new Error(`Can't create project; already exists (${remote}).`);
            logger.error(err);
            throw err;
        }
        try {
            if (await pathExists(projectDir) == false) {
                await mkdir(projectDir);
            }
            await downloadRemote(remote);
            const buildFile = await getWorkflowFile(join(projectDir, PROJECT_BIN_DIR_NAME));
            const buildConfig = await parseWorkflow(buildFile);
            const projectFile = await createProjectFile(join(projectDir, PROJECT_FILE_NAME), remote, buildConfig);
            await mkdir(join(projectDir, PROJECT_LOGS_DIR_NAME));
            await mkdir(join(projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME));
            const project = await InstantiateProject(projectFile);
            this._projects.push(project);
            logger.info(`Created new project '${project.name}' (${remote}).`);
            return project;
        }
        catch (error) {
            const err = new Error(`Failed to create new project (${remote}).`, { cause: error });
            logger.error(err);
            throw err
        }
    }

    /**
     * Loads all existing projects.
     */
    public async LoadAll() {
        logger.info(`Loading projects...`);
        if (await pathExists(PROJECTS_DIR) == false)
        {
            await mkdir(PROJECTS_DIR);
            logger.info(`No projects installed!`);
            return;
        }
        const dir = await readdir(PROJECTS_DIR, { withFileTypes: true });
        const projects = dir.filter(entry => entry.isDirectory()).map(entry => entry.name)
        for (const name of projects) {
            try {
                await this.Load(name);
            }
            catch {
                logger.warn(`Couldn't load project '${name}'.`);
            }
        }
        if (this._projects.length == 0) {
            logger.info(`No projects loaded.`);
        }
        else {
            logger.info(`Loaded all available projects (${projects.length}/${this._projects.length}).`);
        }
    }

    /**
     * Starts all loaded projects present in {@link projects}.
     */
    public async DeployAll() {
        logger.info(`Deploying all projects...`);
        for (const project of this._projects) {
            if (project.deployed == false) {
                try {
                    await project.deploy();
                }
                catch (error) {
                    logger.error(`Project '${project.name}' failed to deploy.`, error);
                }
            }
            else {
                logger.info(`Project '${project.name}' already deployed.`);
            }
        }
        logger.info(`Finished deploying projects!`);
    }

    /**
     * Stops all loaded projects' processes if they have one.
     */
    public async StopAll(force: boolean = false) {
        logger.info(`Stopping projects...`);
        for (const project of this._projects) {
            try {
                if (force === true) {
                    await project.installer.kill(force);
                }
                if (project instanceof ServiceProject) {
                    if (force === true) {
                        await project.process.kill(force);
                    }
                    else {
                        await project.stop();
                    }
                }
                else {
                    await project.stop();
                }
            }
            catch (error) {
                logger.error(`Project '${project.name}' failed to stop.`, error);
            }
        }
        logger.info(`Stopped all project processes!`);
    }

    /**
     * Deletes a given project, including configuration, logs, and binaries.
     */
    public async Delete(target: string | BoopProject): Promise<void> {
        logger.info(`Deleting project '${(typeof (target) == "string") ? target : target.name}'...`);
        const project = (typeof (target) == "string") ? this.projects.find(item => item.name == target) : target;
        if (project == undefined) {
            const err = new Error(`Can't delete project '${(typeof (target) == "string") ? target : target.name}': does not exist.`);
            logger.error(err);
            throw err;
        }
        if (await pathExists(project.rootDir) == false) {
            const err = new Error(`Can't delete project '${(typeof (target) == "string") ? target : target.name}': project directory does not exist.`);
            logger.error(err);
            throw err;
        }
        await project.installer.kill();
        await project.stop();
        await rm(project.rootDir, { recursive: true, force: true });
        const idx = this._projects.indexOf(project);
        this._projects.splice(idx, 1);
        logger.info(`Deleted project '${(typeof (target) == "string") ? target : target.name}'.`);
    }
}

async function createProjectFile(file: string, remoteUrl: string, config: WorkflowConfig): Promise<ProjectConfig> {
    const projectFile: ProjectConfig = {
        repositoryURL: remoteUrl,
        type: config.type,
        acceptBranch: config.branch ?? "main"
    }
    await writeFile(file, JSON.stringify(projectFile));
    return projectFile;
}

const Manager: ProjectManager = new ProjectManager();

export default Manager;