import type { WebhookEvent } from "../api"

export type InstallerStateMessage = {
    type: "installerStart",
    steps: string[],
    time: number,
    eventRef: string | null
} | {
    type: "installerResult",
    success: boolean,
    time: number
} | ProcessStateMessage

export type ProcessStateMessage = {
    type: "processStart",
    time: number,
    cmd: string
} | {
    type: "processExit",
    exitCode: number | null,
    time: number,
    killed: boolean,
} | {
    type: "processOutput",
    output: string
}

export type ProjectStateEvent = {
    type: "deploy",
    success: boolean,
    time: number
} | {
    type: "stop",
    time: number,
    wasKilled: boolean
} | {
    type: "install",
    time: number,
    ref: string | null
} | {
    type: "installerResult",
    success: boolean,
    time: number
} | {
    type: "webhook",
    event: WebhookEvent
} | ProcessStateMessage

export type ProjectStateEvents = ProjectStateEvent["type"];

export type ProjectStatus = 'deployed' | 'stopped' | 'error' | 'installing' | 'installSuccess' | 'installFailed' | 'disposed' | null;
