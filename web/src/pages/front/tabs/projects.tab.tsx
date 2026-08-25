import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowSyncRegular } from "@fluentui/react-icons";
import ProjectList from "../../../components/project/list";
import Section from "../../../components/section";
import { useCallback, useEffect, useState } from "react";
import { BoopAPI, type ProjectEntry } from "../../../api/api";

const REFRESH_TIME_MS = 15000;

export default function BoopProjectsTab() {
    const [projects, setProjects] = useState<ProjectEntry[]>([]);

    const refreshProjectList = useCallback(() => {
        BoopAPI.getProjectList().then(list => {
            setProjects(() => list);
        });
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            refreshProjectList();
        }, REFRESH_TIME_MS);
        refreshProjectList();
        return () => { 
            clearInterval(interval);
        }
    }, []);

    return (
        <Section
            title="Projects"
        >
            <ProjectList
                projects={projects}
                right={ 
                    <Tooltip content={`Refreshes the list of available projects. Updates automatically every ${REFRESH_TIME_MS/1000} seconds.`} relationship="description">
                        <Button icon={<ArrowSyncRegular/>} onClick={refreshProjectList} appearance="subtle"></Button>
                    </Tooltip>
                }
            />
        </Section>
    );
}