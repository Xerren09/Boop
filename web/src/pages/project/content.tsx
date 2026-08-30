import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { BoopAPI, ProjectProvider } from "../../api/api";
import useHashTabs from "../../components/useHashTabs";
import { ProjectTab } from "./tabs/projectTabs.enum";
import { useProjectStreamer } from "../../api/streamers/useProjectStreamer";
import { Tab, Tooltip, TabList, Link, Text } from "@fluentui/react-components";
import DataTable, { DataTableRow } from "../../components/dataTable";
import ProjectControlButton from "../../components/project/controlButton";
import { ProjectStatusIcon } from "../../components/project/statusIcon";
import { ProjectIcon } from "../../components/project/typeIcon";
import Runtime from "../../components/runtime";
import Section from "../../components/section";
import Stack from "../../components/stack";
import ProjectBuildTab from "./build.tab";
import ProjectDeployTab from "./deploy.tab";
import EnvironmentVariableEditor from "./environment.tab";
import ProjectWebhookEventsTab from "./events.tab";
import ProjectLogTab from "./log.tab";
import { useNavigate } from "react-router";
import { ProjectDisposedAlert } from "../../components/project/disposedAlert";

export function ProjectPageContent() {
    const project = useContext(ProjectProvider)!;

    const { projectStatus, lastWebhookEvent, mainProcess } = useProjectStreamer(project.socketUrl, true);

    const { currentTab, switchTab } = useHashTabs(ProjectTab);
    const [port, setPort] = useState<string | null>(null);

    const proxyUrlHref = useMemo(() => { return project?.proxyUrl.toString() }, [project]);
    const directUrlHref = useMemo(() => {
        if (!port) {
            return undefined;
        }
        const url = new URL(BoopAPI._origin);
        url.port = port;
        return url.toString();
    }, [port]);
    
    const resizeObserver = useRef<ResizeObserver>(null);
    const toolbar = useRef<HTMLDivElement>(null);
    const [compactToolbar, setCompactToolbar] = useState<boolean>(false);
    const navigation = useNavigate();

    function onProjectDeleted() {
        navigation("..");
    }

    useEffect(() => {
        if (!resizeObserver.current) {
            resizeObserver.current = new ResizeObserver(() => {
                if (!toolbar.current) {
                    return;    
                }
                if (toolbar.current.offsetWidth < 100 * 4) {
                    setCompactToolbar(() => true);
                }
                else {
                    setCompactToolbar(() => false);
                }
            });
        }
        if (toolbar.current) {
            resizeObserver.current.observe(toolbar.current);
        }
        return () => {
            resizeObserver.current?.disconnect();
        }
    }, []);

    /**
     * Effect for fetching the PORT environment variable on deployed.
     */
    useEffect(() => {
        if (!project || project.type == "webapp" || projectStatus !== "deployed") {
            return;
        }
        project.getEnv("PORT").then(_port => {
            setPort(_port);
        });
    }, [project, projectStatus]);

    useEffect(() => { 
        if (projectStatus === "disposed") {
            switchTab(ProjectTab.Deploy);
        }
    }, [projectStatus]);

    return (
        <>
            {
                <ProjectDisposedAlert open={ projectStatus === "disposed" } />
            }
            {
                // Project info section
            }
            <Section
                icon={
                    <>
                        <ProjectStatusIcon status={projectStatus} />
                        <ProjectIcon type={project.type} size={34}/>
                    </>
                }
                title={project.name}
                headerMargin={18}
            >
                <Stack ref={toolbar} horizontal horizontalFill horizontalAlign="space-between" gap={6} style={{margin: "6px 0px 6px 0px"}}>
                    <Stack horizontal gap={6}>
                        <ProjectControlButton
                            action="start"
                            appearance="subtle"
                            hideLabel={compactToolbar}
                            projectState={projectStatus}
                        />
                        <ProjectControlButton
                            action="stop"
                            appearance="subtle"
                            hideLabel={compactToolbar}
                            projectState={projectStatus}
                        />
                        <ProjectControlButton
                            action="restart"
                            appearance="subtle"
                            hideLabel={ compactToolbar }
                        />
                    </Stack>
                    <Stack horizontal>
                        <ProjectControlButton
                            cancellable
                            action="delete"
                            appearance="subtle"
                            onSettled={onProjectDeleted}
                            hideLabel={ compactToolbar }
                        />
                    </Stack>
                </Stack>
                <DataTable>
                    <DataTableRow label="Remote">
                        <Text><Link href={project.remote} target="_blank">{project.remote}</Link></Text>
                    </DataTableRow>
                    <DataTableRow label="Router">
                        <Tooltip content={ projectStatus == "deployed" ? "This project is available via Boop's proxy at this URL." : "This project is not currently deployed, so the project is unavailable through Boop's proxy." } relationship="description">
                            <Text><Link disabled={ projectStatus != "deployed" } href={proxyUrlHref} target="_blank">{proxyUrlHref}</Link></Text>
                        </Tooltip>
                    </DataTableRow>
                    {
                        project.type == "service" &&
                        <DataTableRow label="Direct">
                            <Tooltip content={ projectStatus == "deployed" ? "This project is available at this port on Boop's host machine." : "This project is not currently deployed, so the project is unavailable." } relationship="description">
                                <Text><Link disabled={ projectStatus != "deployed" } href={directUrlHref} target="_blank">{directUrlHref}</Link></Text>
                            </Tooltip>
                        </DataTableRow>
                    }
                    <DataTableRow label="Last Event">
                        <Text>
                            {
                                // FIXME: communicate that the last event might be without a commit ID
                                lastWebhookEvent === null || lastWebhookEvent.commit.id === null ? "No event received yet."
                                    :
                                <Stack gap={16} horizontal horizontalFill>
                                    <Link href={ lastWebhookEvent.commit.url! } target="_blank">{ `${lastWebhookEvent.commit.id.substring(0, 7)}@${lastWebhookEvent.repository.branch} ` }</Link>
                                    <Runtime since start={lastWebhookEvent.time}></Runtime>
                                </Stack>
                            }
                        </Text>
                    </DataTableRow>
                </DataTable>
            </Section>
            {
                // Tabs and their contents
            }
            <Stack
                gap={12}
                horizontalFill
                verticalFill
                style={{
                    marginBottom: 18,
                }}
            >
                <TabList
                    selectedValue={currentTab}
                    onTabSelect={(_, data) => {
                        switchTab(data.value as number);
                    }}
                    style={{
                        overflowX: "auto"
                    }}
                    disabled={ projectStatus === "disposed" }
                >
                    <Tab value={ ProjectTab.Deploy }>Deploy</Tab>
                    <Tab value={ ProjectTab.Build }>Build</Tab>
                    {
                        project!.type == "service" && <Tab value={ProjectTab.Environment}>Environment</Tab>
                    }
                    <Tab value={ ProjectTab.Events }>Events</Tab>
                    <Tab value={ ProjectTab.Log }>Log</Tab>
                </TabList>

                {
                    currentTab === ProjectTab.Deploy && <ProjectDeployTab process={mainProcess} status={projectStatus} directUrlHref={ directUrlHref } />
                }
                {
                    currentTab === ProjectTab.Build && <ProjectBuildTab/>
                }
                {
                    currentTab === ProjectTab.Environment && <EnvironmentVariableEditor/>
                }
                {
                    currentTab === ProjectTab.Events && <ProjectWebhookEventsTab refreshKey={lastWebhookEvent}/>
                }
                {
                    currentTab === ProjectTab.Log && <ProjectLogTab refreshKey={projectStatus}/>
                }
            </Stack>
        </>
    );
}