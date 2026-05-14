import { useContext, useEffect, useState } from "react";
import Section from "../../components/section";
import { ProjectProvider } from "../../api/api";

export default function ProjectLogTab() {
    const project = useContext(ProjectProvider);
    const [log, setLog] = useState<string>("");

    useEffect(() => { 
        if (project) {
            project.getProjectLog().then((str) => {
                setLog(str!);
            })
        }
    }, [project]);

    return (
        <Section
            title="Log"
            style={{
                marginBottom: 22,
                height: "100%"
            }}
        >
            <textarea
                value={log}
                readOnly={true}
                style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "100%"
                }}
            />
        </Section>
    )
}