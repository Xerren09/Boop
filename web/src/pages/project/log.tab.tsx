import { useContext, useEffect, useState } from "react";
import Section from "../../components/section";
import { ProjectProvider, type LogEntry } from "../../api/api";
import Stack from "../../components/stack";
import LogList from "../../components/logList";

const REFRESH_DEBOUNCE_MS = 1500;

export default function ProjectLogTab(props: {refreshKey?: unknown}) {
    const project = useContext(ProjectProvider);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    function getLog() {
        if (project) {
            project.getProjectLog().then((logs) => {
                if (logs) {
                    setLogEntries(() => logs);
                }
            })
        }
    }

    useEffect(() => { 
        const id = setTimeout(() => {
            getLog();
        }, REFRESH_DEBOUNCE_MS);
        return () => {
            clearTimeout(id);
        };
    }, [props.refreshKey]);

    useEffect(() => {
        getLog();
    }, [project]);

    return (
        <Section
            title="Project Log"
            style={{
                height: "100%"
            }}
        >
            <Stack verticalFill horizontalFill style={{maxHeight: "50vh", overflow: "auto"}}>
                <LogList log={logEntries}/>
            </Stack>
        </Section>
    )
}
