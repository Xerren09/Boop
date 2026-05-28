import { useEffect, useMemo, useState } from "react";
import ProjectList from "../../components/project/list";
import Stack from "../../components/stack";
import { Button, Caption1, LargeTitle, Link, Subtitle2 } from "@fluentui/react-components";
import Runtime from "../../components/runtime";
import { BoopAPI, type BoopStatus, type ProjectEntry } from "../../api/api";
import { ArrowSyncRegular } from "@fluentui/react-icons";
import Section from "../../components/section";

export function FrontPage() {

    const [status, setStatus] = useState<BoopStatus | null>(null);
    const [projects, setProjects] = useState<ProjectEntry[]>([]);

    function updateProjectList() {
        BoopAPI.getProjectList().then(list => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            setProjects(_ => list);
        })
    }

    useEffect(() => {
        window.document.title = "Dashboard | Boop";
        const interval = setInterval(() => {
            updateProjectList();
        }, 15000);
        BoopAPI.getStatus().then(status => {
            if (status) {
                setStatus(status);
            }
        });
        updateProjectList();
        return () => { 
            clearInterval(interval);
        }
    }, []);

    const startupTime = useMemo(() => {
        // eslint-disable-next-line react-hooks/purity
        return status ? Date.now() - (status.uptime * 1000) : 0;
    }, [status])

    return (
        <>
            <Stack gap={36} style={{ padding: 12 }}>
                <Stack>
                    <LargeTitle style={{color: "#00abec"}}>Boop!</LargeTitle>
                    <Subtitle2><Link href="https://github.com/Xerren09/Boop" target="_blank">A lightweight NodeJS CI/CD server for GitHub repositories</Link></Subtitle2>
                    <Caption1 italic>Node { status?.nodeVer }  //  { status?.system }-{ status?.arch }  //  <Runtime short start={startupTime}/></Caption1>
                </Stack>
                <Section
                    title="Projects"
                    right={
                        <Button icon={<ArrowSyncRegular/>} onClick={updateProjectList} appearance="subtle"></Button>
                    }
                >
                    <ProjectList projects={projects}/>
                </Section>
            </Stack>
        </>
    );
}
