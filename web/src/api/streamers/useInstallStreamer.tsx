import { useRef, useState, useEffect } from "react";
import type { InstallerStateMessage } from "./types";
import { BoopAPI, RemoteProcess } from "../api";
import type { Status } from "../../components/statusIcon";

type InstallerStatus = Exclude<Status, "warning">;

export function useInstallStreamer(projectId: string) {
    const _socket = useRef<WebSocket | null>(null);
    const _steps = useRef<RemoteProcess[]>([]);
    const _step = useRef<number>(-1);

    const [triggerEventRef, setTriggerEventRef] = useState<string | null>(null)
    const [installer, setInstaller] = useState<RemoteProcess[]>([])
    const [status, setStatus] = useState<InstallerStatus>("pending")

    const onMessage = (msg: string) => {
        const message: InstallerStateMessage = JSON.parse(msg) as InstallerStateMessage;
        switch (message.type) {
            case "installerStart": {
                const stepList: RemoteProcess[]  = message.steps.map(step => new RemoteProcess(step));
                _steps.current = stepList;
                setInstaller(() => stepList)
                setTriggerEventRef(() => message.eventRef);
                setStatus(() => "pending");
                break;
            }
            case "processStart": {
                // New install step
                const idx = _steps.current.findIndex(step => (step.cmd == message.cmd) && step.exitCode == null);
                _step.current = idx;
                _steps.current[idx].dispatch(message);
                break;
            }
            case "processOutput":
            case "processExit": {
                _steps.current[_step.current].dispatch(message);
                break;
            }
            case "installerResult": {
                setStatus(() => message.success ? "ok" : "error");
                for (let index = _step.current + 1; index < _steps.current.length; index++) {
                    const step = _steps.current[index];
                    step.dispatch({ type: "processExit", exitCode: null, time: 0 });
                }
                _step.current = -1;
                break;
            }
            default: {
                console.warn("Unknown install streamer message:", message);
            }
        }
    }

    useEffect(() => {
        if (_socket.current !== null && _socket.current.readyState === WebSocket.OPEN) {
            return;
        }
        const ws = new WebSocket(`${BoopAPI.constructApiURL(`projects/${projectId}/installer`).toString().replace("http://", "ws://")}`);
        _socket.current = ws;
        const handler = (msg: MessageEvent<unknown>) => {
            onMessage(msg.data as string);
        }
        _socket.current.addEventListener("message", handler);
        return () => {
            _socket.current?.close();
            _socket.current?.removeEventListener("message", handler);
            _socket.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        steps: installer,
        status: status,
        triggerEvent: triggerEventRef,
    };
}