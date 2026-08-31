import { config } from "dotenv";
import { parseArgs, ParseArgsOptionsConfig } from "node:util";
import { BOOP_BASE_DIR, DEBUG_ENV_BYPASS_GIT_PULL_KEY, ENV_DISABLE_WEBHOOK_SECURITY_KEY, ENV_PORT_KEY, ENV_SECRET_KEY } from "./constants.js";
import { join } from "node:path";
config({
    quiet: true,
    path: join(BOOP_BASE_DIR, ".env")
});

const boopArgsOptions: ParseArgsOptionsConfig = {
    port: {
        type: 'string',
    },
    secret: {
        type: 'string',
    },
    disableWebhookSecurity: {
        type: 'boolean'
    }
};
class BoopSettings {
    private _port: number = 8004;
    private _secret: string = "";
    private _debugDisableWebhookSecurity: boolean = false;
    private _debugBypassGitPull: boolean = false;
    private _debugDevEnv: boolean = false;

    constructor() {
        this.load();
    }

    private load() {
        const args = parseArgs({ options: boopArgsOptions });
        // Port flag:
        const port = ((Number((args.values.port as string)) || null) ?? (Number(process.env[ENV_PORT_KEY]) || null) ?? 8004);
        process.env[ENV_PORT_KEY] = `${port}`;
        this._port = port;
        // Secret flag:
        const secret = args.values.secret?.toString() ?? process.env[ENV_SECRET_KEY] ?? "";
        process.env[ENV_SECRET_KEY] = `${secret}`;
        this._secret = secret;
        // DisableWebhookSecurity flag:
        const disableWebhookSecurity = (args.values.disableWebhookSecurity ?? process.env[ENV_DISABLE_WEBHOOK_SECURITY_KEY] ?? false) == true;
        process.env[ENV_DISABLE_WEBHOOK_SECURITY_KEY] = `${disableWebhookSecurity}`;
        this._debugDisableWebhookSecurity = disableWebhookSecurity;
        // BypassGitPull flag:
        const bypassGitPull = process.env[DEBUG_ENV_BYPASS_GIT_PULL_KEY]?.toLowerCase() === "true";
        this._debugBypassGitPull = bypassGitPull;
        // Environment:
        const devEnv = process.env["NODE_ENV"] == "development";
        this._debugDevEnv = devEnv;
    }

    get port() {
        return this._port;
    }

    get secret() {
        return this._secret;
    }

    get DEBUG_DisableWebhookSecurity() {
        return this._debugDisableWebhookSecurity;
    }

    get DEBUG_DisableGitPull() {
        return this._debugBypassGitPull;
    }

    get DEBUG() {
        return this._debugDevEnv;
    }
}

export const BoopConfiguration = new BoopSettings();