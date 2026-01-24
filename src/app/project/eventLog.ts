import { existsSync, readFileSync } from "fs";
import type { WebhookEvent } from "../webhook.js";
import { writeFile } from "fs/promises";

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

    public get lastEvent(): WebhookEvent | null {
        return this._events[this._events.length - 1] ?? null;
    }

    constructor(file: string) {
        // HACK: This loads via the sync methods but only once.
        this._file = file;
        if (existsSync(this._file)) {
            const text = readFileSync(this._file).toString('utf8');
            this._events = JSON.parse(text);
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