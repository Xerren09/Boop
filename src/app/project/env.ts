import { writeFile, readFile } from "fs/promises";
import { pathExists } from "../utilities.js";

export type Environment = {
    [key: string]: string | number
}

export class EnvFile {
    private _env: Environment = {};

    /**
     * The system path of this file.
     */
    public readonly file: string;

    /**
     * An copy of the variables saved.
     */
    public get variables(): Environment {
        return { ...this._env }
    }

    constructor(file: string) {
        this.file = file;
    }

    public async load() {
        if (await pathExists(this.file)) {
            const text = (await readFile(this.file)).toString('utf8');
            if (text.length != 0) {
                const p = JSON.parse(text) as Environment;
                for (const key of Object.keys(p)) {
                    this.set(key, p[key]);
                }
            }
        }
        else {
            throw new Error(`File '${this.file}' does not exist.`);
        }
    }

    public set(key: string, value: string | number) {
        this._env[key.toUpperCase()] = value;
    }

    public get(key: string): string | number | null {
        key = key.toUpperCase();
        if (this._env[key] != undefined) {
            return this._env[key];
        }
        return null;
    }

    public delete(key: string) {
        key = key.toUpperCase();
        if (this._env[key] != undefined) {
            delete this._env[key];
        }
    }

    public async save() {
        await writeFile(this.file, JSON.stringify(this._env));
    }
}