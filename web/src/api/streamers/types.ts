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
    time: number
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
    time: number
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

export type ProjectStatus = 'deployed' | 'stopped' | 'installing' | 'installFailed' | null;