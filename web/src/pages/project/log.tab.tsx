import { useContext, useEffect, useState } from "react";
import Section from "../../components/section";
import { ProjectProvider, type LogEntry } from "../../api/api";
import Stack from "../../components/stack";
import LogList from "../../components/logList";


export default function ProjectLogTab() {
    const project = useContext(ProjectProvider);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    useEffect(() => {
        if (project) {
            project.getProjectLog().then((logs) => {
                if (logs) {
                    setLogEntries(() => logs.reverse());
                }
            })
        }
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
