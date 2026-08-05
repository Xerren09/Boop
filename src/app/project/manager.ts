import { PROJECT_BIN_DIR_NAME, PROJECT_FILE_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME, PROJECTS_DIR } from "../../constants.js";
import { join } from "path";
import logger from "../../logger.js";
import { BoopProject, createProjectFile, type ProjectConfig } from "./boop.project.js";
import { ServiceProject } from "./service.project.js";
import { mkdir, rm, writeFile, readdir } from "fs/promises";
import { getProjectNameFromRemote, IAsyncDisposable, pathExists } from "../utilities.js";
import { downloadRemote } from "../shell/git.js";
import { getWorkflowFile, parseWorkflow, WorkflowConfig } from "../workflow.js";
import { InstantiateProject } from "./instantiate.js";
import { InstallStreamerCollection } from "../interfaces/http/ws/install.streamer.js";
import { ProjectStreamerCollection } from "../interfaces/http/ws/project.streamer.js";

class ProjectManager implements IAsyncDisposable {
    private _disposed = false;
    get disposed(): boolean {
        return this._disposed;
    }
    
    private _projects: BoopProject[] = [];
    /**
     * The list of all loaded projects known to Boop.
     */
    public get projects() : readonly BoopProject[] {
        return this._projects;
    }

    public Find(name: string): BoopProject | undefined {
        return this.projects.find(el => el.name == name);
    }

    /**
     * Loads a project with the specified name.
     * @param projectName 
     */
    public async Load(projectName: string) {
        if (this._projects.find(el => el.name === projectName) != undefined) {
            return;
        }
        const projectFile = join(PROJECTS_DIR, projectName, PROJECT_FILE_NAME);
        try {
            if (await pathExists(projectFile) == false) {
                throw new Error(`Project does not exist.`);
            }
            const project = await InstantiateProject(projectFile);
            this._projects.push(project);
            logger.info(`Loaded project '${project.name}'`);
        }
        catch (err) {
            const error = new Error(`Failed to load project '${projectName}'`, { cause: err });
            logger.logException(error);
            throw error;
        }
    }

    /**
     * Unloads the given project from memory.
     * @param target 
     */
    public async Unload(target: string | BoopProject) {
        const project = (typeof (target) == "string") ? this.Find(target) : target;
        if (project == undefined) {
            throw new Error(`Project does not exist.`);
        }
        try {
            // Remove project from the list before we unload it so if it fails it doesn't stay available in an invalid state
            const idx = this._projects.indexOf(project);
            this._projects.splice(idx, 1);
            const _disposer = new AsyncDisposableStack();
            _disposer.use(project);
            InstallStreamerCollection.filter(streamer => streamer.project == project).forEach(el => _disposer.use(el));
            ProjectStreamerCollection.filter(streamer => streamer.project == project).forEach(el => _disposer.use(el));
            await _disposer.disposeAsync();
            logger.info(`Unloaded project '${project.name}'`);
        }
        catch (err) {
            const error = new Error(`Failed to unload project '${project.name}'`, { cause: err });
            logger.logException(error);
            throw error;
        }
    }

    /**
     * Creates a new project.
     * @param name 
     * @param remote 
     * @returns 
     */
    public async Create(remote: string, branch?: string | null): Promise<BoopProject> {
        const name = getProjectNameFromRemote(remote);
        if (name == null) {
            throw new Error(`Could not extract valid project name from "${remote}"`);
        }
        const projectDir = join(PROJECTS_DIR, name);
        try {
            if (await pathExists(join(projectDir, PROJECT_FILE_NAME))) {
                throw new Error(`Project already exists.`);
            }
            if (await pathExists(projectDir) == false) {
                await mkdir(projectDir);
            }
            await downloadRemote(remote, branch);
            const buildFile = await getWorkflowFile(join(projectDir, PROJECT_BIN_DIR_NAME));
            const buildConfig = await parseWorkflow(buildFile);
            const projectFile = await createProjectFile(join(projectDir, PROJECT_FILE_NAME), remote, buildConfig);
            await mkdir(join(projectDir, PROJECT_LOGS_DIR_NAME));
            await mkdir(join(projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_INSTALL_DIR_NAME));
            await mkdir(join(projectDir, PROJECT_LOGS_DIR_NAME, PROJECT_LOGS_DEPLOY_DIR_NAME));
            const project = await InstantiateProject(projectFile);
            this._projects.push(project);
            logger.info(`Created new project.`, {
                remote: remote,
                branch: branch ?? "main",
                dir: projectDir
            });
            return project;
        }
        catch (error) {
            // Do cleanup
            if (await pathExists(projectDir)) {
                await rm(projectDir, { recursive: true, force: true });
            }
            const err = new Error(`Failed to create new project (${remote}).`, { cause: error });
            logger.logException(err);
            throw err;
        }
    }

    /**
     * Deletes a given project, including configuration, logs, and binaries.
     */
    public async Delete(target: string | BoopProject): Promise<void> {
        const project = (typeof (target) == "string") ? this.Find(target) : target;
        if (project == undefined) {
            throw new Error(`Project does not exist.`);
        }
        try {
            await this.Unload(target);
            //
            if (await pathExists(project.projectDir)) {
                await rm(project.projectDir, { recursive: true, force: true });
            }
            else {
                logger.warn(`Project directory '${project.projectDir}' does not exist: this project only exists in memory.`);
            }
            logger.info(`Deleted project '${project.name}'.`);
        }
        catch (err) {
            const error = new Error(`Failed to delete project '${project.name}'`, { cause: err });
            logger.logException(error);
            throw error;
        }
    }

    /**
     * Loads all existing projects.
     */
    public async LoadAll() {
        if (await pathExists(PROJECTS_DIR) == false)
        {
            await mkdir(PROJECTS_DIR);
            return;
        }
        const dir = await readdir(PROJECTS_DIR, { withFileTypes: true });
        const projects = dir.filter(entry => entry.isDirectory()).map(entry => entry.name);
        const errors: any[] = [];
        for (const name of projects) {
            try {
                await this.Load(name);
            }
            catch (err) {
                errors.push(err);
            }
        }
        logger.info(`Loaded ${this._projects.length}/${projects.length} projects.`);
        if (errors.length != 0) {
            throw new AggregateError(errors, `One or more projects could not be loaded.`);
        }
    }

    /**
     * Starts all loaded projects present in {@link projects}.
     */
    public async DeployAll() {
        const errors: any[] = [];
        for (const project of this._projects) {
            if (project.deployed == false) {
                try {
                    await project.deploy();
                    console.info(`Deployed project '${project.name}'.`);
                }
                catch (err) {
                    errors.push(err);
                    console.error(`Failed to deploy project '${project.name}'.`);
                }
            }
            else {
                console.info(`Project '${project.name}' already deployed.`);
            }
        }
        logger.info(`Deployed ${this._projects.length - errors.length}/${this._projects.length} projects.`);
        if (errors.length != 0) {
            throw new AggregateError(errors, `One or more projects could not be deployed.`);
        }
    }

    /**
     * Stops all loaded projects' processes if they have one.
     */
    public async StopAll(force: boolean = false) {
        const errors: any[] = [];
        for (const project of this._projects) {
            try {
                if (force === true) {
                    await project.installer.kill(force);
                }
                if (project instanceof ServiceProject) {
                    if (force === true) {
                        await project.process?.kill(true, force);
                    }
                    else {
                        await project.stop();
                    }
                }
                else {
                    await project.stop();
                }
                logger.info(`Stopped project '${project.name}'`);
            }
            catch (err) {
                logger.error(`Failed to stop project '${project.name}'`);
                errors.push(err);
            }
        }
        logger.info(`Stopped ${this._projects.length - errors.length}/${this._projects.length} projects.`);
        if (errors.length != 0) {
            throw new AggregateError(errors, `One or more projects failed to stop.`);
        }
    }

    /**
     * Stops and disposes of all loaded projects, effectively shutting down the whole system.
     * @returns 
     */
    public async [Symbol.asyncDispose]() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        const errors: any[] = [];
        do {
            const project = this._projects[0];
            try {
                await this.Unload(project);
            }
            catch (e) {
                errors.push(e);
            }
        } while (this._projects.length != 0);
        if (errors.length != 0) {
            logger.warn("Not all projects shut down. This might mean some processes are still alive after Boop shuts down...");
            throw new AggregateError(errors, `One or more projects failed to dispose properly.`);
        }
    }
}

const Manager: ProjectManager = new ProjectManager();

export default Manager;