import { useCallback, useEffect, useRef, useState } from "react";
import { type ProjectStateEvent, type ProjectStatus } from "./types";
import { BoopAPI, RemoteProcess, type WebhookEvent } from "../api";

export function useProjectStreamer(projectId: string): {projectStatus: ProjectStatus, lastWebhookEvent: WebhookEvent | null}
export function useProjectStreamer(projectId: string, withProcess: boolean): {projectStatus: ProjectStatus, lastWebhookEvent: WebhookEvent | null, mainProcess: RemoteProcess | null}
export function useProjectStreamer(projectId: string, withProcess?: boolean) {
    const socket = useRef<WebSocket | null>(null);

    const [mainProcess, setMainprocess] = useState<RemoteProcess | null>(null);
    const [projectStatus, setStatus] = useState<ProjectStatus>(null);
    const [lastWebhookEvent, setLastWebhookEvent] = useState<WebhookEvent | null>(null);

    const _process = useRef<RemoteProcess | null>(null);

    const onMessage = useCallback((msg: string) => {
        const message: ProjectStateEvent = JSON.parse(msg) as ProjectStateEvent;
        switch (message.type) {
            case "install": {
                setStatus("installing");
                break;
            }
            case "webhook": {
                setLastWebhookEvent(message.event);
                break;
            }
            case "processStart": {
                const process = new RemoteProcess(message.cmd);
                process.dispatch(message);
                _process.current = process;
                setMainprocess(_process.current)                
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
                    setStatus("installFailed");
                }
                else {
                    setStatus("installSuccess");
                }
                break;
            }
            case "deploy": {
                setStatus(message.success ? "deployed" : "error");
                break;
            }
            case "stop": {
                setStatus(message.wasKilled ? "stopped" : "error");
                break;
            }
            default: {
                console.log(message);
            }
        }
    }, [])

    useEffect(() => {
        if (socket.current !== null && socket.current.readyState === WebSocket.OPEN) {
            return;
        }
        const ws = new WebSocket(`${BoopAPI.constructApiURL(`projects/${projectId}?withProcess=${withProcess ?? false}`).toString().replace("http://", "ws://")}`);
        socket.current = ws;
        ws.addEventListener("message", (message) => {
            onMessage(message.data);
        });
        return () => {
            ws.close(1000, "client dispose");
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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