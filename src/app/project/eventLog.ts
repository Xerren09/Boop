import type { WebhookEvent } from "../webhook.js";
import { readFile, writeFile } from "fs/promises";
import { pathExists } from "../utilities.js";

export class EventsFile {
    private _file: string;
    private _maxItems: number = 255;
    private _events: WebhookEvent[] = [];
    /**
     * The list of previous webhook events.
     */
    public get events(): readonly WebhookEvent[] {
        return this._events;
    }

    /**
     * The latest event in the history. `null` if the event history is empty.
     */
    public get lastEvent(): WebhookEvent | null {
        return this._events[this._events.length - 1] ?? null;
    }

    constructor(file: string) {
        this._file = file;
    }

    public exists(id: string): boolean {
        return this.events.findIndex(el => el.id == id) != -1;
    }

    public async load() {
        if (await pathExists(this._file)) {
            const text = (await readFile(this._file)).toString('utf8');
            this._events = JSON.parse(text);
        }
        else {
            throw new Error(`File '${this._file}' does not exist.`);
        }
    }

    public add(evt: WebhookEvent) {
        if (this._events.length > this._maxItems) {
            this._events.shift();
        }
        this._events.push(evt);
    }

    public async save() {
        await writeFile(this._file, JSON.stringify(this._events))
    }
}