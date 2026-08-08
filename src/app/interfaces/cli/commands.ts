import { Interface } from "node:readline/promises";
import { styleText } from "node:util";
import { AppProject } from "../../project/app.project.js";
import { BoopProject } from "../../project/boop.project.js";
import Manager from "../../project/manager.js";
import { ServiceProject } from "../../project/service.project.js";
import { getProjectNameFromRemote } from "../../utilities.js";
import { BOOP_PORT } from "../../settings.js";

interface CMD {
    command: string,
    alias?: string[],
    func: (cli: Interface, command: string, args: string[]) => Promise<void>,
    /**
     * The description of the command used by `help` to provide details.
     */
    description?: string,
    /**
     * List of flags this command takes. Used by `help` to provide details.
     */
    flags?: string[],
    /**
     * Arguments that are always available for this command.
     */
    persistentArgs?: string[],
    /**
     * List of arguments this command expects. Used by `help` to provide details.
     */
    expectsArgsLike?: string[]
}

export const CLICommands: CMD[]  = [
    {
        command: "status",
        func: status,
        description: "Returns the status of all, or a given project.",
        persistentArgs: ["all"],
        expectsArgsLike: ["projectId"]
    },
    {
        command: "start",
        func: start,
        alias: ["deploy"],
        description: "Starts all, or a given project.",
        persistentArgs: ["all"],
        expectsArgsLike: ["projectId"]
    },
    {
        command: "stop",
        func: stop,
        description: "Stops all, or a given project. When shutting down all projects, use the -force flag to forcefully kill them.",
        flags: ["-force"],
        persistentArgs: ["all"],
        expectsArgsLike: ["projectId"]
    },
    {
        command: "restart",
        func: restart,
        description: "Restarts all, or a given project.",
        persistentArgs: ["all"],
        expectsArgsLike: ["projectId"]
    },
    {
        command: "install",
        func: install,
        description: "Installs a project from the given URL.",
        expectsArgsLike: ["githubURL"]
    },
    {
        command: "uninstall",
        func: uninstall,
        description: "Stops, then deletes a given project. This permanently deletes project files and can not be undone.",
        expectsArgsLike: ["projectId"]
    },
    {
        command: "exit",
        description: "Shuts down all projects and exits Boop.",
        func: exit
    },
    {
        command: "help",
        description: "Prints all commands and their related info.",
        func: help,
    }
]

function throwIfNoArgs(args: string[], expects?: string) {
    if (args.length == 0) {
        throw new Error(`No arguments passed with command${ expects !== undefined ? `: <${expects}>.`: "."}`);
    }
}

function throwIfProjectNotFound(project: any, name: string): asserts project is BoopProject {
    if (!project) {
        throw new Error(`No project with the name '${name}' was found. Check autocomplete for available projects.`);
    }
}

async function start(cli: Interface, command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    if (args[0] == "all") {
        await Manager.DeployAll();
        return;
    }
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    console.log("Deploying...");
    await project.deploy();
    console.log("Deployed!");
}

async function stop(cli: Interface, command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    if (args[0] == "all") {
        const force = args[1] == "-force"
        await Manager.StopAll(force);
        return;
    }
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    console.log("Stopping...");
    await project.stop();
    console.log("Stopped!");
}

async function restart(cli: Interface, command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    console.log("Restarting...");
    await project.restart();
    console.log("Restarted!");
}

async function status(cli: Interface, command: string, args: string[]) {
    if (args[0] == "all" || args[0] == undefined) {
        for (let index = 0; index < Manager.projects.length; index++) {
            const project = Manager.projects[index];
            projectStatusReadout(project);
            if (index + 1 != Manager.projects.length) {
                console.log("\n");
            }
        }
        return;
    }
    throwIfNoArgs(args, "projectId");
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    projectStatusReadout(project);
}

function projectStatusReadout(project: BoopProject) {
    console.log(`${project.name}:`, styleText(project.deployed ? "greenBright" : "redBright", `${project.deployed ? "deployed" : "stopped"}`));
    console.log(`\tType:`, `${project.type}`);
    console.log(`\tRouter:`, styleText("blueBright", project.deployed ? `http://localhost:${BOOP_PORT}/${project.name}` : '---'));
    if (project instanceof ServiceProject) {
        console.log(`\tDirect:`, styleText("blueBright", project.deployed ? `http://localhost:${project.environment.get("port")}/` : '---'));
    }
    if (project instanceof AppProject) {
        console.log(`\tIndex:`, styleText("blueBright", `${project.indexPath}`));
    }
}

async function install(cli: Interface, command: string, args: string[]) {
    throwIfNoArgs(args, "repositoryUrl");
    const remote = args[0];
    const branch = args[1] ?? null;
    const name = getProjectNameFromRemote(remote);
    if (URL.canParse(remote) == false || name === null) {
        throw new Error(`Invalid URL, '${remote}' is a not valid github repository.`);;
    }
    console.log("Downloading project from ", remote, branch, "...");
    const fresh = await Manager.Create(remote, branch);
    console.log("Project successfully created.");
    console.log("Installing...");
    await fresh.install();
    console.log("Installed!");
    console.log("Deploying...");
    await fresh.deploy();
    console.log("Deployed!");
}

async function uninstall(cli: Interface, command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    const answer = (await cli.question(`Are you sure you want to uninstall '${projectName}'? This will delete all project files and can not be undone. (y/n)\n`)).toLowerCase();
    if (answer === "y" || answer === "yes") {
        console.log("Uninstalling project...");
        await Manager.Delete(project);
        console.log("Uninstalled!");
    }
}

async function exit(cli: Interface, command: string, args: string[]) {
    cli.close();
}

async function help(cli: Interface, command: string, args: string[]) {
    for (const entry of CLICommands) {
        console.log(styleText("blue", `\n${entry.command}`), ":");
        console.log(`\t${entry.description}`);
        if (entry.expectsArgsLike || entry.persistentArgs) {
            console.log(`\tArgs: ${[...(entry.expectsArgsLike ?? []).map(el => styleText("blueBright", `<${el}>`)), ...(entry.persistentArgs ?? []).map(el => styleText("blueBright", `${el}`))].join(", ")}`);
        }
        if (entry.flags) {
            console.log(`\tFlags: ${[...entry.flags ?? []].map(el => styleText("gray", `${el}`)).join(", ")}`);
        }
    }
}