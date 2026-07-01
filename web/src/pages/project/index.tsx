import { HomeColor } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import ProjectWebhookEventsTab from "./events.tab";
import { useNavigate, useParams } from "react-router";
import EnvironmentVariableEditor from "./environment.tab";
import  Stack from "../../components/stack";
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Link, Tab, TabList, Text, Tooltip } from "@fluentui/react-components";
import Section from "../../components/section";
import DataTable, { DataTableRow } from "../../components/dataTable";
import Runtime from "../../components/runtime";
import { BoopAPI, BoopProject, ProjectProvider } from "../../api/api";
import ProjectControlButton from "../../components/project/controlButton";
import { ProjectStatusIcon } from "../../components/project/statusIcon";
import { ProjectIcon } from "../../components/project/typeIcon";
import ProjectPageSkeleton from "./skeleton";
import ProjectLogTab from "./log.tab";
import ProjectDeployTab from "./deploy.tab";
import { useProjectStreamer } from "../../api/streamers/useProjectStreamer";
import ProjectInstallerTab from "./build.tab";
import { ProjectTab } from "./tabs/tabs.enum";
import useProjectTabs from "./tabs/useProjectTabs";

export function ProjectPage() {
    const { projectId } = useParams<string>();
    const navigation = useNavigate();

    const { projectStatus, lastWebhookEvent, mainProcess } = useProjectStreamer(projectId!, true);

    const [project, setProject] = useState<BoopProject | null>(null);
    const { currentTab, switchTab } = useProjectTabs();
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

    function onProjectDeleted() {
        navigation("..");
    }

    /**
     * Effect for fetching the PORT environment variable on deployed.
     */
    useEffect(() => {
        if (!project || project.type == "webapp") {
            return;
        }
        project.getEnv("PORT").then(_port => {
            setPort(_port);
        });
    }, [project, projectStatus]);

    useEffect(() => {
        window.document.title = `${projectId} | Boop`;
        async function getProject() {
            if (projectId) {
                const proj = await BoopAPI.getProject(projectId);
                if (proj) {
                    setProject(proj);
                }
                else {
                    navigation("..");
                }
            }
        }
        getProject();
    }, [navigation, projectId]);

    const resizeObserver = useRef<ResizeObserver>(null);
    const toolbar = useRef<HTMLDivElement>(null);
    const [compactToolbar, setCompactToolbar] = useState<boolean>(false);
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
    }, [project]);

    
    if (!project || !projectId) {
        return <ProjectPageSkeleton/>
    }

    return (
        <ProjectProvider value={project}>
            <Stack horizontalAlign="start" style={{ minWidth: "75%", marginTop: 12, padding: 12 }} gap={12} verticalFill horizontalFill>
                <Breadcrumb size="large">
                    <BreadcrumbItem>
                        <BreadcrumbButton onClick={() => { navigation(".."); }}><HomeColor fontSize={24}/></BreadcrumbButton>
                    </BreadcrumbItem>
                    <BreadcrumbDivider />
                    <BreadcrumbItem>
                        <BreadcrumbButton current>{ projectId }</BreadcrumbButton>
                    </BreadcrumbItem>
                </Breadcrumb>
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
                    <Stack ref={toolbar} horizontal horizontalFill horizontalAlign="space-between" gap={6}>
                        <Stack horizontal gap={6}>
                            <ProjectControlButton
                                action="start"
                                appearance="subtle"
                                hideLabel={ compactToolbar }
                            />
                            <ProjectControlButton
                                action="stop"
                                appearance="subtle"
                                hideLabel={ compactToolbar }
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
                    >
                        <Tab value={ ProjectTab.Deploy }>Deploy</Tab>
                        <Tab value={ ProjectTab.Build }>Build</Tab>
                        {
                            project.type == "service" && <Tab value={ ProjectTab.Environment }>Environment</Tab>
                        }
                        <Tab value={ ProjectTab.Events }>Events</Tab>
                        <Tab value={ ProjectTab.Log }>Log</Tab>
                    </TabList>

                    {
                        currentTab === ProjectTab.Deploy && <ProjectDeployTab process={mainProcess} status={projectStatus} directUrlHref={ directUrlHref } />
                    }
                    {
                        currentTab === ProjectTab.Build && <ProjectInstallerTab projectId={ projectId }/>
                    }
                    {
                        currentTab === ProjectTab.Environment && <EnvironmentVariableEditor/>
                    }
                    {
                        currentTab === ProjectTab.Events && <ProjectWebhookEventsTab/>
                    }
                    {
                        currentTab === ProjectTab.Log && <ProjectLogTab/>
                    }
                </Stack>
                
            </Stack>
        </ProjectProvider>
    );
}
