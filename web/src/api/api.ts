import { createContext } from "react";
import type { ProcessStateMessage } from "./streamers/types";
import { ReplaySubject, type Observable } from "rxjs";

const apiPathFragment = "/boop/api/";

export const ProjectProvider = createContext<BoopProject | null>(null);

export class BoopAPI {
    static _origin: URL = new URL(window.location.origin);
    static get origin() {
        return this._origin;
    }
    static _apiURL: URL = new URL(apiPathFragment, this._origin);
    static get apiUrl() {
        return this._apiURL;
    }

    static setOrigin(origin: string | URL | null) {
        if (origin == null) {
            this._origin = new URL(window.location.origin);
        }
        else if (typeof origin === "string") {
            this._origin = new URL(origin);
        }
        else {
            this._origin = origin;
        }
        this._apiURL = new URL(apiPathFragment, this._origin);
    }

    static constructApiURL(fragment: string) : URL {
        return new URL(fragment, this._apiURL);
    }

    static getStatus(): Promise<BoopStatus | undefined> {
        return makeRequest<BoopStatus>(this.constructApiURL(`status`), "GET");
    }

    static async getProjectList(): Promise<ProjectEntry[]> {
        const arr = await makeRequest<ProjectEntry[]>(this.constructApiURL(`projects`), "GET");
        return arr ?? []
    }

    static async getProject(projectId: string) {
        const projectInfo = await makeRequest<ProjectInfo>(this.constructApiURL(`projects/${projectId}`), "GET");
        if (projectInfo) {
            return new BoopProject(projectInfo.name, projectInfo.remote, projectInfo.type);
        }
        else {
            throw `No project with ID "${projectId}" exists.`;
        }
    }

    static deleteProject(projectId: string) {
        return makeRequest<ProjectInfo>(this.constructApiURL(`projects/${projectId}`), "DELETE");
    }
}

export class BoopProject {
    readonly name: string;
    readonly remote: string;
    readonly type: ProjectType;
    readonly baseUrl: URL;
    readonly proxyUrl: URL;

    constructor(name: string, remote: string, type: ProjectType) {
        this.name = name;
        this.remote = remote;
        this.type = type;
        this.baseUrl = BoopAPI.constructApiURL(`projects/${this.name}/`);
        this.proxyUrl = new URL(name, BoopAPI.origin);
    }

    private getRequestUrl(path: string, qparams?: { [key: string]: number | string, }): URL {
        const ret = new URL(path, this.baseUrl);
        if (qparams) {
            for (const element of Object.keys(qparams)) {
                ret.searchParams.append(element, `${qparams[element]}`);
            }
        }
        return ret;
    }

    getInfo() : Promise<ProjectInfo | undefined> {
        return makeRequest<ProjectInfo>(this.baseUrl, "GET");
    }

    start() {
        return makeRequest(this.getRequestUrl("start"), "POST");
    }

    stop() {
        return makeRequest(this.getRequestUrl("stop"), "POST");
    }

    delete() {
        return makeRequest(this.getRequestUrl("delete"), "DELETE");
    }

    restart() {
        return makeRequest(this.getRequestUrl("restart"), "POST");
    }

    async getEnv() : Promise<ProjectEnv | null>
    async getEnv(key: string) : Promise<string | null>
    async getEnv(key?: string): Promise<ProjectEnv | string | null> {
        if (key !== undefined) {
            const ret = await makeRequest<string>(this.getRequestUrl(`env/${key}`), "GET");
            return ret ?? null;
        }
        else {
            const ret = await makeRequest<ProjectEnv>(this.getRequestUrl("env"), "GET");
            return ret ?? null;
        }
    }

    setEnv(envKey: string, value: string) {
        return makeRequest<void>(this.getRequestUrl("env"), "PATCH", { key: envKey, value: value });
    }

    deleteEnv(envKey: string) {
        return makeRequest(this.getRequestUrl("env"), "DELETE", { key: envKey });
    }

    getProjectLog() : Promise<string | undefined> {
        // logs/project
        return makeRequest<string>(this.getRequestUrl(`logs/project`), "GET", undefined);
    }

    async getWebhookLog() : Promise<WebhookEvent[]> {
        const ret = await makeRequest<WebhookEvent[]>(this.getRequestUrl("logs/webhook"), "GET");
        return ret ?? [];
    }

    async listDeployLogs() : Promise<EventLog[]> {
        const ret = await makeRequest<EventLog[]>(this.getRequestUrl("logs/deploy"), "GET");
        return ret ?? [];
    }

    getDeployLog(log: string) : Promise<string | undefined> {
        // logs/deploy/:log
        return makeRequest<string>(this.getRequestUrl(`logs/deploy/${log}`), "GET", undefined);
    }

    async listInstallLogs() : Promise<EventLog[]> {
        // logs/install
        const ret = await makeRequest<EventLog[]>(this.getRequestUrl("logs/install"), "GET");
        return ret ?? [];
    }

    getInstallLog(log: number) : Promise<InstallerLog>
    getInstallLog(log: number, step: number) : Promise<string>
    getInstallLog(log: number, step?: number) : Promise<InstallerLog | string | undefined> {
        // logs/install/:log
        if (step === undefined) {
            return makeRequest<InstallerLog>(this.getRequestUrl(`logs/install/${log}`), "GET");
        }
        else {
            return makeRequest<string>(this.getRequestUrl(`logs/install/${log}`, { step }), "GET");
        }
    }
}

async function makeRequest<T>(url: string | URL, method: "GET" | "POST" | "DELETE" | "PATCH", body?: object) : Promise<T | undefined> {
    const response = await fetch(url, {
        method: method,
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? {
            "Content-Type": "application/json",
        } : undefined
    });
    try {
        const typeHeader = response.headers.get("content-type");
        if (!typeHeader) {
            throw "Invalid response; missing content-type header";
        }
        const type = typeHeader.split(";")[0];
        let ret: unknown;
        switch (type) {
            case "application/json":
                ret = await response.json();
                break;
            case "text/plain":
            default:
                ret = await response.text();
        }
        if (response.ok) {
            return ret as T;
        }
        else {
            throw ret;
        }
    }
    catch (err) {
        if (response.ok == false) {
            throw err;
        }
    }
}


export interface WebhookEvent {
    /**
     * The unique ID of this event delivery. This will be the same for original *and* redeliveries as well.
     * 
     * Determined by the value of the `X-GitHub-Delivery` header.
     */
    id: string;
    /**
     * The type of the event, as configured on github. See {@link https://docs.github.com/en/webhooks/webhook-events-and-payloads|webhook events and payloads}.
     * 
     * Determined by the value of the `X-GitHub-Event` header.
     */
    type: string;  // "ping"
    /**
     * The time this event was reveived by Boop.
     */
    time: number,
    /**
     * Information about the source repository, including which branch triggered this event.
     */
    repository: {
        url: string;
        /**
         * The branch this event originates from. `null` if `ref` is not set in the event payload.
         */
        branch: string | null;
        name: string;
        owner: {
            name: string;
            url: string;
        },
    },
    /**
     * The commit that triggered this event.
     */
    commit: {
        id: string | null;
        url: string | null;
    },
    /**
     * Information about if the event is secure and originated from github.
     * 
     * If the payload's hash and the request hash don't match, `valid` will be false.
     */
    security: {
        /**
         * The value of the `X-Hub-Signature-256` header. Use a repository secret to ensure events are secure.
         */
        hash: string | null;
        valid: boolean;
    },
    /**
     * The user that triggered this event. Usually this is the same as the commit's user.
     */
    sender: {
        name: string;
        url: string;
    }
}

export interface EventLog {
    time: number,
    eventReference?: string,
    dir: string
}

export interface InstallerLog {
    time: number,
    ref?: string | null,
    steps: {
        cmd: string,
        log: string,
        exitCode: number | null,
        startTime: number,
        exitTime: number
    }[]
}

export type ProjectType = "webapp" | "service";

export interface ProjectInfo {
    name: string,
    deployed: boolean,
    remote: string,
    type: ProjectType,
    lastEvent: WebhookEvent | null,
    localPort: number | null
}

export interface ProjectEnv {
    [key: string]: string;
}

export interface BoopStatus {
    projects: number,
    uptime: number,
    nodeVer: string,
    system: string,
    arch: string
}

export interface ProjectEntry {
    name: string,
    remote: string,
    type: ProjectType,
    deployed: boolean,
    lastEventTime: number,
}


export class RemoteProcess {
    static readonly MAX_OUTPUT_HISTORY: number = 2500;

    cmd: string;

    private _output: ReplaySubject<string>;
    output: Observable<string>;
    
    exitCode: number | null = null;
    startTime: number | null = null;
    exitTime: number | null = null;

    killed: boolean = false;

    /**
     * Indicates that the process exited.
     * 
     * Will also return `true` if {@link dud} is true.
     */
    get exited(): boolean {
        return this.dud || (this._output.closed && this.exitCode !== null);
    }

    /**
     * Indicates that this remote process was expected to start, but never did and will not start in the future.
     */
    get dud(): boolean {
        return this._output.closed && this.exitCode === null;
    }

    constructor(cmd: string) {
        this.cmd = cmd;
        this._output = new ReplaySubject<string>(RemoteProcess.MAX_OUTPUT_HISTORY);
        this.output = this._output as Observable<string>;
    }

    dispatch(message: ProcessStateMessage) {
        switch (message.type) {
            case "processStart": {
                this.startTime = message.time;
                break;
            }
            case "processExit": {
                this.exitCode = message.exitCode;
                // Special case to signal that the process will never start, but we want it to be dead.
                this.exitTime = message.time == 0 ? null : message.time;
                this.killed = message.killed;
                this._output.complete();
                break;
            }
            case "processOutput": {
                this._output.next(message.output);
                break;
            }
            default: {
                console.log(message);
            }
        }
    }
}