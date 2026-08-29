import { useRef, useState, useEffect } from "react";
import type { InstallerStateMessage } from "./types";
import { RemoteProcess } from "../api";
import type { Status } from "../../components/statusIcon";
import { BoopSocket } from "./BoopSocket";

// Exclude disposed because if it goes offline the project main ws will too and that triggers a dialog
export type InstallerStatus = NonNullable<Exclude<Status, "warning" | "paused" | "disposed">>;

export function useInstallStreamer(installSocketUrl: URL) {
    const socket = useRef<BoopSocket<InstallerStateMessage> | null>(null);
    const _steps = useRef<RemoteProcess[]>([]);
    const _step = useRef<number>(-1);

    const [triggerEventRef, setTriggerEventRef] = useState<string | null>(null)
    const [installer, setInstaller] = useState<RemoteProcess[]>([])
    const [status, setStatus] = useState<InstallerStatus>("pending")

    const onMessage = (message: InstallerStateMessage) => {
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
                    step.dispatch({ type: "processExit", exitCode: null, time: 0, killed: false });
                }
                _step.current = -1;
                break;
            }
            default: {
                console.error("Unknown InstallStreamer message received:", message);
            }
        }
    }

    useEffect(() => {
        if (socket.current !== null && socket.current.readyState === WebSocket.OPEN) {
            return;
        }
        const ws = new BoopSocket<InstallerStateMessage>(installSocketUrl);
        socket.current = ws;
        const sub = ws.message.subscribe((msg) => { 
            onMessage(msg);
        });
        return () => {
            sub.unsubscribe();
            ws.dispose();
        }
    }, [installSocketUrl]);

    return {
        steps: installer,
        status: status,
        triggerEvent: triggerEventRef,
    };
}