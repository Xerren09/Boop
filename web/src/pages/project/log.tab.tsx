import { useCallback, useContext, useEffect, useState } from "react";
import Section from "../../components/section";
import { ProjectProvider, type LogEntry } from "../../api/api";
import LogList from "../../components/logList";

const REFRESH_DEBOUNCE_MS = 1500;

export default function ProjectLogTab(props: {refreshKey?: unknown}) {
    const project = useContext(ProjectProvider);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const getLog = useCallback(() => {
        if (project) {
            project.getProjectLog().then((logs) => {
                if (logs) {
                    setLogEntries(() => logs);
                }
            })
        }
    }, [project]);

    useEffect(() => { 
        const id = setTimeout(() => {
            getLog();
        }, REFRESH_DEBOUNCE_MS);
        return () => {
            clearTimeout(id);
        };
    }, [getLog, props.refreshKey]);

    useEffect(() => {
        getLog();
    }, [getLog, project]);

    return (
        <Section
            title="Project Log"
            style={{
                height: "100%"
            }}
        >
            <LogList log={logEntries} style={{maxHeight: "50vh", height: "50vh"}}/>
        </Section>
    )
}
