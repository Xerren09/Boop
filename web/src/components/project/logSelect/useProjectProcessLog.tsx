import { useContext, useState, useEffect, useCallback } from "react";
import { type EventLog, ProjectProvider } from "../../../api/api";
import type { CompletedProcess } from "../../processGroup";

/**
 * Gets a list of completed processes from the project logs.
 * @param logType 
 * @param file 
 * @returns 
 */
export default function useProjectProcessLog(logType: "build" | "deploy", file: EventLog | null) {
    const project = useContext(ProjectProvider);

    const [processes, setProcesses] = useState<CompletedProcess[]>([]);

    useEffect(() => {
        if (!project) {
            return;
        }
        if (!file) {
            return;
        }
        if (logType == "build") {
            project.getInstallLog(file.time).then(log => {
                const processes: CompletedProcess[] = [];
                for (const element of log.steps) {
                    processes.push({
                        ...element,
                        output: null
                    });
                }
                setProcesses(() => processes);
            });
        }
        else if (logType == "deploy" && project.type == "service") {
            project.getDeployLog(file.time).then(log => {
                const process: CompletedProcess = {
                    ...log.process,
                    output: null
                }
                const processes: CompletedProcess[] = [process];
                setProcesses(() => processes);
            });
        }
    }, [logType, file, project]);

    const requestProcessOutput = useCallback((idx: number) => {
        if (!project) {
            return;
        }
        if (!file) {
            return;
        }
        if (!processes[idx] || processes[idx].output != null) {
            return;
        }
        if (logType == "deploy" && project.type == "webapp") {
            return;
        }
        const req = logType == "build" ? project.getInstallLog(file.time, idx) : project.getDeployLog(file.time, true);
        req.then(output => {
            const _steps = [...processes];
            const step = _steps[idx];
            step.output = output;
            setProcesses(() => _steps);
        });
    }, [file, logType, processes, project]);

    return {
        processes: file === null ? [] : processes,
        requestProcessOutput
    }
}