import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectStateEvent, ProjectStatus } from "./types";
import { RemoteProcess, type WebhookEvent } from "../api";
import { BoopSocket } from "./BoopSocket";

export function useProjectStreamer(projectSocketUrl: URL): {projectStatus: ProjectStatus, lastWebhookEvent: WebhookEvent | null}
export function useProjectStreamer(projectSocketUrl: URL, withProcess: boolean): {projectStatus: ProjectStatus, lastWebhookEvent: WebhookEvent | null, mainProcess: RemoteProcess | null}
export function useProjectStreamer(projectSocketUrl: URL, withProcess?: boolean) {
    const socket = useRef<BoopSocket<ProjectStateEvent> | null>(null);

    const [mainProcess, setMainprocess] = useState<RemoteProcess | null>(null);
    const [projectStatus, setStatus] = useState<ProjectStatus>(null);
    const [lastWebhookEvent, setLastWebhookEvent] = useState<WebhookEvent | null>(null);

    const _process = useRef<RemoteProcess | null>(null);

    const url = useMemo(() => {
        if (withProcess) {
            const _url = new URL(projectSocketUrl);
            _url.searchParams.set("withProcess", "true");
            return _url;
        }
        else {
            return projectSocketUrl;
        }
    }, [projectSocketUrl, withProcess])

    const onMessage = (message: ProjectStateEvent) => {
        switch (message.type) {
            case "install": {
                setStatus(() => "installing");
                break;
            }
            case "webhook": {
                setLastWebhookEvent(() => message.event);
                break;
            }
            case "processStart": {
                const process = new RemoteProcess(message.cmd);
                process.dispatch(message);
                _process.current = process;
                setMainprocess(() => _process.current)                
                break;
            }
            case "processOutput":
            case "processExit": {
                if (_process.current) {
                    _process.current.dispatch(message);
                }
                break;
            }
            case "installerResult": {
                if (message.success == false) {
                    setStatus(() => "installFailed");
                }
                else {
                    setStatus(() => "installSuccess");
                }
                break;
            }
            case "deploy": {
                setStatus(() => message.success ? "deployed" : "error");
                break;
            }
            case "stop": {
                setStatus(() => message.wasKilled ? "stopped" : "error");
                break;
            }
            default: {
                console.error("Unknown ProjectStreamer message received:", message);
            }
        }
    }

    useEffect(() => {
        if (socket.current !== null && socket.current.readyState === WebSocket.OPEN) {
            return;
        }
        const ws = new BoopSocket<ProjectStateEvent>(url);
        socket.current = ws;
        const onDispose = (evt: CloseEvent) => { 
            if (evt.reason == "PROJECT_DISPOSE") {
                setStatus(() => "disposed");
            }
        };
        ws.socket?.addEventListener("close", onDispose);
        const sub = ws.message.subscribe((msg) => { 
            onMessage(msg as ProjectStateEvent);
        });
        return () => {
            ws.socket?.removeEventListener("close", onDispose);
            sub.unsubscribe();
            ws.dispose();
        }
    }, [url]);

    if (withProcess === undefined) {
        return {
            projectStatus,
            lastWebhookEvent,
        };
    }
    else {
        return {
            projectStatus,
            lastWebhookEvent,
            mainProcess,
        };
    }
    
}