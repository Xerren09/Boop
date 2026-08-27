import Manager from "../../project/manager.js";
import { createInterface, type Interface } from "node:readline/promises";
import type { CompleterResult } from "node:readline";
import { CLICommands } from "./commands.js";

export function createCLI() {
    let __shouldContinue = true;
    const cli = createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: completer,
        prompt: "BOOP> "
    });
    cli.on("line", async (str) => {
        const line = str.trim();
        try {
            const handled = await selector(cli, line);
            if (handled == false) {
                if (line.trim().length != 0) {
                    console.error(`Unknown command '${line.trim()}'.`);
                }
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
        cli.close();
    });
    cli.on("close", () => {
        __shouldContinue = false;
    });
    return cli;
}

async function selector(cli: Interface, command: string): Promise<boolean> {
    const input = command.toLowerCase();
    for (const entry of CLICommands) {
        if (input.startsWith(`${entry.command} `) || (input.startsWith(`${entry.command}`) && input.length == entry.command.length)) {
            await entry.func(cli, entry.command, parseArgs(command, entry.command));
            return true;
        }
    }
    return false;
}

function findCompletionMatches(list: string[], part: string): string[] {
    const hits = list.filter(c => c.startsWith(part)) ?? [];
    return hits.length ? hits : list;
}

function completer(line: string): CompleterResult {
    const parts = line.split(' ');
    let completions: string[] = [];
    if (parts.length <= 1) {
        // Complete commands
        const cmdPart = parts[0];
        completions = findCompletionMatches(CLICommands.map(el => el.command), cmdPart);
    }
    else if (parts.length == 2) {
        // Complete project ids as main args
        const cmdPart = parts[0];
        const argPart = parts[1];
        line = parts.slice(-1)[0];
        const list = [...Manager.projects.map(el => el.name), ...CLICommands.find(el => el.command == cmdPart)?.persistentArgs ?? []];
        completions = findCompletionMatches(list, argPart)
    }
    return [completions, line];
}

function parseArgs(str: string, command: string) {
    const ret = str.substring(command.length).trim().split(" ").filter(el => el);
    if (ret[0] != undefined && ret[0] == "")
    {
        return [];
    }
    else {
        return ret;
    }
}