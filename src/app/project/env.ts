import { existsSync, readFileSync, writeFileSync } from "fs";
import { writeFile } from "fs/promises";

export type Environment = {
    [key: string]: string | number
}

export class EnvFile {
    private _file: string;
    private _env: Environment = {};
    public get env(): Environment {
        return { ...this._env }
    }

    constructor(file: string) {
        this._file = file;
        // HACK: This loads via the sync methods but only once.
        if (existsSync(this._file)) {
            const text = readFileSync(this._file).toString('utf8');
            if (text.length != 0) {
                const p = JSON.parse(text) as Environment;
                for (const key of Object.keys(p)) {
                    this.set(key, p[key]);
                }
            }
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
        await writeFile(this._file, JSON.stringify(this._env));
    }
}