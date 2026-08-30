import { createContext } from "react";
import type { ProcessStateMessage } from "./streamers/types";
import { ReplaySubject, Subject, type Observable } from "rxjs";

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

    private static errorEmitter: Subject<unknown> = new Subject();

    static get onError() {
        return this.errorEmitter as Observable<unknown>;
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
        return this.makeRequest<BoopStatus>(this.constructApiURL(`status`), "GET");
    }

    static async getProjectList(): Promise<ProjectEntry[]> {
        const arr = await this.makeRequest<ProjectEntry[]>(this.constructApiURL(`projects`), "GET");
        return arr ?? []
    }

    static async getProject(projectId: string) {
        try {
            const projectInfo = await this.makeRequest<ProjectInfo>(this.constructApiURL(`projects/${projectId}`), "GET");
            if (projectInfo) {
                return new BoopProject(projectInfo.name, projectInfo.remote, projectInfo.type);
            }
        }
        catch (err) {
            if (err instanceof APIError) {
                if (err.name == "APIError") {
                    throw new Error(`No project with ID "${projectId}" exists.`);
                }
            }
            throw err;
        }
    }

    static deleteProject(projectId: string) {
        return this.makeRequest<ProjectInfo>(this.constructApiURL(`projects/${projectId}`), "DELETE");
    }

    private static async makeRequest<T>(url: string | URL, method: "GET" | "POST" | "DELETE" | "PATCH", body?: object) : Promise<T | undefined> {
        try {
            const ret = await makeRequest<T>(url, method, body);
            return ret;
        }
        catch (err) {
            this.errorEmitter.next(err);
            throw err;
        }
    };
}


export class BoopProject  {
    readonly name: string;
    readonly remote: string;
    readonly type: ProjectType;
    readonly baseUrl: URL;
    readonly proxyUrl: URL;
    readonly installSocketUrl: URL;
    readonly socketUrl: URL;

    private readonly errorEmitter: Subject<unknown>;

    get onError() {
        return this.errorEmitter as Observable<unknown>;
    }

    constructor(name: string, remote: string, type: ProjectType) {
        this.name = name;
        this.remote = remote;
        this.type = type;
        this.baseUrl = BoopAPI.constructApiURL(`projects/${this.name}/`);
        this.proxyUrl = new URL(name, BoopAPI.origin);
        const sockUrl = new URL(this.baseUrl);
        sockUrl.protocol = "ws:";
        this.socketUrl = sockUrl;
        const instUrl = new URL("installer", this.baseUrl);
        instUrl.protocol = "ws:";
        this.installSocketUrl = instUrl;
        this.errorEmitter = new Subject<unknown>();
    }

    private getRequestUrl(path: string, qparams?: { [key: string]: number | string | boolean, }): URL {
        const ret = new URL(path, this.baseUrl);
        if (qparams) {
            for (const element of Object.keys(qparams)) {
                ret.searchParams.append(element, `${qparams[element]}`);
            }
        }
        return ret;
    }

    async makeProjectRequest<T>(url: string | URL, method: "GET" | "POST" | "DELETE" | "PATCH", body?: object) : Promise<T | undefined> {
        try {
            const ret = await makeRequest<T>(url, method, body);
            return ret;
        }
        catch (err) {
            this.errorEmitter.next(err);
            throw err;
        }
    };

    getInfo() : Promise<ProjectInfo | undefined> {
        return this.makeProjectRequest<ProjectInfo>(this.baseUrl, "GET");
    }

    start() {
        return this.makeProjectRequest(this.getRequestUrl("start"), "POST");
    }

    stop() {
        return this.makeProjectRequest(this.getRequestUrl("stop"), "POST");
    }

    delete() {
        return this.makeProjectRequest(this.getRequestUrl("delete"), "DELETE");
    }

    restart() {
        return this.makeProjectRequest(this.getRequestUrl("restart"), "POST");
    }

    async getEnv() : Promise<ProjectEnv | null>
    async getEnv(key: string) : Promise<string | null>
    async getEnv(key?: string): Promise<ProjectEnv | string | null> {
        if (key !== undefined) {
            try {
                const ret = await this.makeProjectRequest<string>(this.getRequestUrl(`env/${key}`), "GET");
                return ret ?? null;
            }
            catch {
                return null;
            }
        }
        else {
            const ret = await this.makeProjectRequest<ProjectEnv>(this.getRequestUrl("env"), "GET");
            return ret ?? null;
        }
    }

    setEnv(key: string, value: string) {
        return this.makeProjectRequest<void>(this.getRequestUrl("env"), "PATCH", { key: key, value: value });
    }

    deleteEnv(key: string) {
        return this.makeProjectRequest(this.getRequestUrl("env"), "DELETE", { key: key });
    }

    async getProjectLog() : Promise<LogEntry[] | undefined> {
        // logs/project
        const str = await this.makeProjectRequest<string>(this.getRequestUrl(`logs/project`), "GET");
        return parseSystemLog(str!);
    }

    async getWebhookLog() : Promise<WebhookEvent[]> {
        const ret = await this.makeProjectRequest<WebhookEvent[]>(this.getRequestUrl("logs/webhook"), "GET");
        return ret ?? [];
    }

    async listDeployLogs() : Promise<EventLog[]> {
        const ret = await this.makeProjectRequest<EventLog[]>(this.getRequestUrl("logs/deploy"), "GET");
        return ret ?? [];
    }

    async getDeployLog(log: number) : Promise<ServiceDeployLog>
    async getDeployLog(log: number, processOutput: true) : Promise<string>
    async getDeployLog(log: number, processOutput?: boolean) : Promise<ServiceDeployLog | string | undefined> {
        // logs/deploy/:log
        if (processOutput) {
            return this.makeProjectRequest<string>(this.getRequestUrl(`logs/deploy/${log}`, {process: true}), "GET", undefined);
        }
        return this.makeProjectRequest<ServiceDeployLog>(this.getRequestUrl(`logs/deploy/${log}`), "GET", undefined);
    }

    async listInstallLogs() : Promise<EventLog[]> {
        // logs/install
        const ret = await this.makeProjectRequest<EventLog[]>(this.getRequestUrl("logs/install"), "GET");
        return ret ?? [];
    }

    getInstallLog(log: number) : Promise<InstallerLog>
    getInstallLog(log: number, step: number) : Promise<string>
    getInstallLog(log: number, step?: number) : Promise<InstallerLog | string | undefined> {
        // logs/install/:log
        if (step === undefined) {
            return this.makeProjectRequest<InstallerLog>(this.getRequestUrl(`logs/install/${log}`), "GET");
        }
        else {
            return this.makeProjectRequest<string>(this.getRequestUrl(`logs/install/${log}`, { step }), "GET");
        }
    }
}



export class APIError extends Error {
    readonly url?: URL = undefined;

    constructor(message?: string, options?: { url?: string | URL, name?: string } & ErrorOptions) {
        super(message, options);
        if (options?.name && options?.name.length != 0) {
            this.name = options.name;
        }
        else {
            this.name = "APIError";
        }
        if (options?.url) {
            this.url = new URL(options.url);
        }
    }
}

async function makeRequest<T>(url: string | URL, method: "GET" | "POST" | "DELETE" | "PATCH", body?: object): Promise<T | undefined> {
    let response: Response | undefined = undefined;
    const stringBody = body ? JSON.stringify(body) : undefined;
    try {
        response = await fetch(url, {
            method: method,
            body: stringBody,
            headers: body ? {
                "Content-Type": "application/json",
            } : undefined
        });
    }
    catch (err) {
        throw new APIError("Could not connect to Boop API", { cause: err, name: "ConnectionError", url });
    }
    const typeHeader = response.headers.get("content-type");
    if (!typeHeader) {
        throw new APIError("Response is missing its content-type header", { url });
    }
    try {
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
            throw new APIError("Request returned an error", { cause: err, url });
        }
        // This is probably a decode error, not an API error.
        throw err;
    }
}

function parseSystemLog(str: string): LogEntry[] {
    const rawEntries = str!.split(/\r?\n/);
    const entries: LogEntry[] = [];
    for (const element of rawEntries) {
        try {
            if (!element || element === "") {
                continue;
            }
            const obj = JSON.parse(element);
            entries.push(obj);
        }
        catch {
            console.warn("Log line is not a valid JSON:", element);
        }
    }
    return entries;
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
    ref: string | null,
    steps: {
        cmd: string,
        log: string,
        exitCode: number | null,
        startTime: number,
        exitTime: number,
        killed: boolean
    }[]
}

export interface ServiceDeployLog {
    time: number,
    ref: string | null,
    process: InstallerLog["steps"][number]
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

export interface LogEntry {
    level: "info" | "warn" | "error" | "debug",
    message: string,
    metadata: {
        timestamp: string
    }
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