import * as fs from "fs";
import * as path from "path"

import { projectsFolderPath, projectsSettingsFolderPath } from '../constants'
import { writeInternalProjectConfig } from "../projects";
import { spawn } from "child_process";

const stdout: string[] = [];
const stderr: string[] = [];

async function start() {
    console.log(`${process.argv[2]} worker started.`);
    
    const configPath = path.join(projectsSettingsFolderPath, `${process.argv[2]}.json`);
    let config: Project = JSON.parse(fs.readFileSync(configPath).toString()) as Project;
    const port = Number(process.argv[3]);

    let command = config.config?.run || "";
    const platform = process.platform;
    if (platform == "win32") {
        command = `set PORT=${port}&& ${command}`;
    }
    else {
        command = `export PORT=${port}&& ${command}`;
    }
    
    // Save command so it can be viewed online
    if (config.flow) {
        config.flow.final = {
            command: command,
            output: [],
            error: [],
            exitCode: -1
        };
        writeInternalProjectConfig(config);
    }

    const exec = spawn(command, [], { cwd: config.path, shell: true });
    
    exec.on("close", (code) => {
        config = JSON.parse(fs.readFileSync(configPath).toString()) as Project;
        if (config.flow) {
            config.flow.final = {
                command: command,
                output: stdout,
                error: stderr,
                exitCode: code || 1
            };
            writeInternalProjectConfig(config);
        }
        console.log(`${process.argv[2]} process stopped (${code}).`);
    });

    exec.stdout.on("data", (data) => {
        stdout.push(data.toString());
    });

    exec.stderr.on("data", (data) => {
        stderr.push(data.toString());
    });
}

start();