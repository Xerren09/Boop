import { writeFile, readFile } from "fs/promises";
import { pathExists } from "../utilities.js";

export type Environment = {
    [key: string]: string | number | boolean
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
                for (const _key of Object.keys(p)) {
                    const key = this.normaliseKey(_key);
                    this.set(key, p[key]);
                }
            }
        }
        else {
            throw new Error(`File '${this.file}' does not exist.`);
        }
    }

    public set(key: string, value: string | number | boolean) {
        key = this.normaliseKey(key);
        this._env[key] = value;
    }

    public get(key: string): string | number | boolean | null {
        key = this.normaliseKey(key);
        if (this._env[key] != undefined) {
            return this._env[key];
        }
        return null;
    }

    public has(key: string): boolean {
        key = this.normaliseKey(key);
        return this._env[key] !== undefined;
    }

    public delete(key: string) {
        key = this.normaliseKey(key);
        if (this._env[key] != undefined) {
            delete this._env[key];
        }
    }

    public async save() {
        await writeFile(this.file, JSON.stringify(this._env));
    }

    private normaliseKey(val: string) {
        return `${val}`.toUpperCase();
    }
}