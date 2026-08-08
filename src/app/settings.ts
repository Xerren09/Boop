import { config } from "dotenv";
import { parseArgs, ParseArgsOptionsConfig } from "node:util";
import { DEBUG_ENV_BYPASS_GIT_PULL_KEY, ENV_DISABLE_WEBHOOK_SECURITY_KEY, ENV_PORT_KEY, ENV_SECRET_KEY } from "./constants.js";
config({ quiet: true });

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
const args = parseArgs({ options: boopArgsOptions });

// Port flag:
const port = ((Number((args.values.port as string)) || null) ?? (Number(process.env[ENV_PORT_KEY]) || null) ?? 8004);
process.env[ENV_PORT_KEY] = `${port}`;
// Secret flag:
const secret = args.values.secret ?? process.env[ENV_SECRET_KEY] ?? "";
process.env[ENV_SECRET_KEY] = `${secret}`;
// DisableWebhookSecurity flag:
const disableWebhookSecurity = args.values.disableWebhookSecurity ?? process.env[ENV_DISABLE_WEBHOOK_SECURITY_KEY] ?? false;
process.env[ENV_DISABLE_WEBHOOK_SECURITY_KEY] = `${disableWebhookSecurity}`;

export const BOOP_PORT = port;
export const BOOP_SECRET = process.env[ENV_SECRET_KEY] ?? null;
export const BOOP_DISABLE_WEBHOOK_SECURITY = process.env[ENV_DISABLE_WEBHOOK_SECURITY_KEY]?.toLowerCase() === "true";
export const DEBUG_ENV_BYPASS_GIT_PULL = process.env[DEBUG_ENV_BYPASS_GIT_PULL_KEY]?.toLowerCase() === "true";