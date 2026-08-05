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
import EventEmitter from "events";

interface ProjectManagerEvents {
    "create": (project: BoopProject) => void;
    'unload': (project: BoopProject) => void;
    'load': (project: BoopProject) => void;
}

interface ProjectManager {
    on<EventType extends keyof ProjectManagerEvents>(event: EventType, listener: ProjectManagerEvents[EventType]): this;
    once<EventType extends keyof ProjectManagerEvents>(event: EventType, listener: ProjectManagerEvents[EventType]): this;
    emit<EventType extends keyof ProjectManagerEvents>(event: EventType, ...args: Parameters<ProjectManagerEvents[EventType]>): boolean;
    removeListener<EventType extends keyof ProjectManagerEvents>(event: EventType, listener: ProjectManagerEvents[EventType]): this;
    removeAllListeners<EventType extends keyof ProjectManagerEvents>(event?: EventType): this;
}

class ProjectManager extends EventEmitter implements IAsyncDisposable {
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
     */
    public async Load(projectName: string): Promise<BoopProject> {
        const _search = this.Find(projectName);
        if (_search != undefined) {
            return _search;
        }
        try {
            logger.info(`Loading project '${projectName}'.`);
            const projectFile = join(PROJECTS_DIR, projectName, PROJECT_FILE_NAME);
            if (await pathExists(projectFile) == false) {
                throw new Error(`Project does not exist on disk.`);
            }
            const project = await InstantiateProject(projectFile);
            this._projects.push(project);
            logger.info(`Loaded project '${project.name}'`);
            this.emit("load", project);
            return project;
        }
        catch (err) {
            const error = new Error(`Failed to load project '${projectName}'`, { cause: err });
            throw error;
        }
    }

    /**
     * Unloads the given project from memory.
     * @param target A `BoopProject` instance or its name.
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
            this.emit("unload", project);
            await project[Symbol.asyncDispose]();
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
     * @param remote Git remote to clone the project from.
     * @param branch [Optional] Target branch to clone.
     * @returns 
     */
    public async Create(remote: string, branch?: string | null): Promise<BoopProject> {
        logger.info(`Creating new project from '${remote}'.`);
        const projectName = getProjectNameFromRemote(remote);
        if (projectName == null) {
            logger.error(`Could not extract valid project name from "${remote}"`);
            throw new Error(`Could not extract valid project name from "${remote}"`);
        }
        const projectDir = join(PROJECTS_DIR, projectName);
        try {
            if (await pathExists(join(projectDir, PROJECT_FILE_NAME))) {
                logger.error(`Project already exists.`);
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
            const project = await this.Load(projectName);
            logger.info(`Created new project.`, {
                remote: remote,
                branch: branch ?? "main",
                dir: projectDir
            });
            this.emit("create", project);
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
     * @param target A `BoopProject` instance or its name.
     */
    public async Delete(target: string | BoopProject): Promise<void> {
        logger.info(`Deleting project '${(typeof (target) == "string") ? target : target.name}'.`);
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
        logger.info(`Loading all projects.`);
        if (await pathExists(PROJECTS_DIR) == false)
        {
            logger.info(`Projects directory does not exist, creating it.`);
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
                logger.error(`Failed to load project '${name}'.`);
                errors.push(err);
            }
        }
        if (errors.length != 0) {
            logger.warn("Some projects failed to load.");
            throw new AggregateError(errors, `One or more projects could not be loaded.`);
        }
        else {
            logger.info("Loaded all projects.");
        }
    }

    /**
     * Starts all loaded projects present in {@link projects}.
     */
    public async DeployAll() {
        const errors: any[] = [];
        logger.info("Deploying all projects.");
        for (const project of this._projects) {
            if (project.deployed == false) {
                try {
                    await project.deploy();
                }
                catch (err) {
                    errors.push(err);
                    logger.error(`Failed to deploy project '${project.name}'.`);
                }
            }
        }
        if (errors.length != 0) {
            logger.warn("Some projects failed to deploy.");
            throw new AggregateError(errors, `One or more projects could not be deployed.`);
        }
        else {
            logger.info("Deployed all projects.");
        }
    }

    /**
     * Stops all loaded projects' processes if they have one.
     * @param force Force flag passed to {@link ServiceProject} processes. See `BoopProcess.kill(boolean, boolean);`
     */
    public async StopAll(force: boolean = false) {
        const errors: any[] = [];
        logger.info("Stopping all projects.");
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
            }
            catch (err) {
                logger.error(`Failed to stop project '${project.name}'`);
                errors.push(err);
            }
        }
        if (errors.length != 0) {
            logger.error(`Not all projects were stopped successfully. Some processes may linger.`);
            throw new AggregateError(errors, `One or more projects failed to stop.`);
        }
        else {
            logger.info("Stopped all projects.");
        }
    }

    /**
     * Stops and disposes of all loaded projects, effectively shutting down the whole system.
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