import Manager from "../project/manager.js";
import { styleText } from "node:util";
import { BoopProject } from "../project/boop.project.js";
import { ServiceProject } from "../project/service.project.js";
import { ENV_PORT } from "../../constants.js";
import { AppProject } from "../project/app.project.js";
import { createInterface } from "node:readline/promises";
import { CompleterResult } from "node:readline";
import { getProjectNameFromRemote } from "../utilities.js";
import assert from "node:assert";

interface CLICommand {
    command: string,
    func: (command: string, args: string[]) => Promise<void>,
}

const commands: CLICommand[]  = [
    {
        command: "status",
        func: status,
    },
    {
        command: "start",
        func: start,
    },
    {
        command: "stop",
        func: stop,
    },
    {
        command: "restart",
        func: restart,
    },
    {
        command: "add",
        func: add
    },
    {
        command: "remove",
        func: remove
    },
    {
        command: "exit",
        func: exit
    }
]

export const cli = createInterface( process.stdin, process.stdout, completer);
cli.setPrompt("BOOP>");
/**
 * Flag to determine if the CLI should prompt again after executing a command handler.
 */
let __shouldContinue = true;

cli.on('line', async (str) => {
    const line = str.trim();
    try {
        const handled = await selector(line);
        if (handled == false) {
            console.error(`Unknown command '${line.trim()}'.`);
        }
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }
    finally {
        if (__shouldContinue) {
            cli.prompt();
        }
    }
});

cli.on('SIGINT', () => {
    __shouldContinue = false;
    cli.close();
});

async function selector(command: string): Promise<boolean> {
    const normal = command.toLowerCase();
    for (const clicommand of commands) {
        if (normal.startsWith(`${clicommand.command}`)) {
            await clicommand.func(clicommand.command, getArgs(command, clicommand.command));
            return true;
        }
    }
    return false;
}

function completer(line: string): CompleterResult {
    const parts = line.split(' ');
    if (parts.length <= 1) {
        return [[], line];
    }
    const argPart = parts[1];
    const completions = Manager.projects.map(el => el.name) ?? [];
    const hits = completions.filter((c) => c.startsWith(argPart)) ?? [];
    line = parts.slice(-1)[0];
    return [hits.length ? hits : completions, line];
}

function getArgs(str: string, command: string) {
    const ret = str.substring(command.length).trim().split(" ");
    if (ret[0] != undefined && ret[0] == "")
    {
        return []
    }
    else {
        return ret;
    }
}

function throwIfNoArgs(args: string[], expects?: string) {
    if (args.length == 0) {
        throw new Error(`No arguments passed with command${ expects !== undefined ? `: <${expects}>.`: "."}`);
    }
}

function throwIfProjectNotFound(project: any, name: string): asserts project is BoopProject {
    assert(project, `No project with the name '${name}' was found. Check autocomplete for available projects.`);
}

// ----- Command handlers -----

async function start(command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    if (args[0] == "all") {
        await Manager.DeployAll();
        return;
    }
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    await project.deploy();
}

async function stop(command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    if (args[0] == "all") {
        const force = args[1] == "force"
        await Manager.StopAll(force);
        return;
    }
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    await project.stop();
}

async function restart(command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    await project.restart();
}

async function status(command: string, args: string[]) {
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
    console.log(`\tRouter:`, styleText("blueBright", project.deployed ? `http://localhost:${ENV_PORT}/${project.name}` : '---'));
    if (project instanceof ServiceProject) {
        console.log(`\tDirect:`, styleText("blueBright", project.deployed ? `http://localhost:${project.environment.get("port")}/` : '---'));
    }
    if (project instanceof AppProject) {
        console.log(`\tIndex:`, styleText("blueBright", `${project.indexPath}`));
    }
}

async function add(command: string, args: string[]) {
    throwIfNoArgs(args, "repositoryUrl");
    const remote = args[0];
    const name = getProjectNameFromRemote(remote);
    if (URL.canParse(remote) == false || name === null) {
        throw new Error(`Invalid URL, '${remote}' is a not valid github repository.`);;
    }
    const fresh = await Manager.Create(name, remote);
    await fresh.install();
    await fresh.deploy();
}

async function remove(command: string, args: string[]) {
    throwIfNoArgs(args, "projectId");
    const projectName = args[0] ?? "";
    const project = Manager.Find(projectName);
    throwIfProjectNotFound(project, projectName);
    const answer = (await cli.question(`Are you sure you want to remove '${projectName}'? This will delete all project files and can not be undone. (y/n)\n`)).toLowerCase();
    if (answer === "y" || answer === "yes") {
        await Manager.Delete(project);
    }
}

async function exit(command: string, args: string[]) {
    __shouldContinue = false;
    cli.close();
}