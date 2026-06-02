import { HomeColor } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import ProjectWebhookEventsTab from "./eventsTab";
import { useNavigate, useParams } from "react-router";
import EnvironmentVariableEditor from "./variables";
import  Stack from "../../components/stack";
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Link, Tab, TabList, Text, Toolbar, ToolbarGroup, Tooltip } from "@fluentui/react-components";
import Section from "../../components/section";
import DataTable, { DataTableRow } from "../../components/dataTable";
import Runtime from "../../components/runtime";
import { BoopAPI, BoopProject, ProjectProvider } from "../../api/api";
import ProjectControlButton from "../../components/project/controlButton";
import { ProjectStatusIcon } from "../../components/project/statusIcon";
import { ProjectIcon } from "../../components/project/typeIcon";
import ProjectPageSkeleton from "./skeleton";
import ProjectLogTab from "./logTab";
import ProjectDeployTab from "./deployTab";
import { useProjectStreamer } from "../../api/streamers/useProjectStreamer";
import ProjectInstallerTab from "./installerTab";
import { Tabs } from "./tabs";

function getFirstNavTargetTab() {
    const hashTab = window.location.hash.substring(1, window.location.hash.length);
    if (hashTab.length == 0) {
        return 0;
    }
    const tabIdx = Tabs[hashTab as keyof typeof Tabs];
    return tabIdx as number;
}

export function ProjectPage() {
    const { projectId } = useParams<string>();
    const navigation = useNavigate();

    const { projectStatus, lastWebhookEvent, mainProcess } = useProjectStreamer(projectId!, true);

    const [project, setProject] = useState<BoopProject | null>(null);
    const [currentTab, setCurrentTab] = useState<number>(getFirstNavTargetTab);
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
    }, [projectId]);

    /**
     * Effect for synchronising window location hash with the current tab
     */
    useEffect(() => {
        const tabHash = `#${Tabs[currentTab]}`;
        if (currentTab == undefined || window.location.hash == tabHash) {
            return;
        }
        window.location.hash = tabHash;
        // HACK: Clear out any query params when navigating between tabs
        const newUrl = new URL(window.location.href);
        newUrl.search = "";
        window.history.pushState(null, '', newUrl);
    }, [currentTab]);

    /**
     * Effect for handling window location hash changes, and switching tabs accordingly
     */
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash.length == 0) {
                return;
            }
            if (currentTab == undefined) {
                return;
            }
            const tabHash = `#${Tabs[currentTab]}`;
            if (window.location.hash == tabHash) {
                return;
            }
            console.log("changing tabs", "from", `#${Tabs[currentTab]}`, "to", window.location.hash);
            const hashTargetTab = window.location.hash.substring(1, window.location.hash.length);
            const tabIdx = Tabs[hashTargetTab as keyof typeof Tabs] as number;
            setCurrentTab(() => tabIdx);
        };
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [currentTab]);
    
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
                    <Toolbar style={{ justifyContent: "space-between", width: "100%" }}>
                        <ToolbarGroup>
                            <ProjectControlButton
                                action="start"
                                appearance="subtle"
                            />
                            <ProjectControlButton
                                action="stop"
                                appearance="subtle"
                            />
                            <ProjectControlButton
                                action="restart"
                                appearance="subtle"
                            />
                        </ToolbarGroup>
                        <ToolbarGroup>
                            <ProjectControlButton
                                cancellable
                                action="delete"
                                appearance="subtle"
                                onSettled={onProjectDeleted}
                            />
                        </ToolbarGroup>
                    </Toolbar>  
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
                        onTabSelect={(tab, data) => {
                            setCurrentTab(data.value as number);
                        }}
                        style={{
                            overflowX: "auto"
                        }}
                    >
                        <Tab value={ Tabs.deploy }>Deploy</Tab>
                        <Tab value={ Tabs.install }>Build</Tab>
                        {
                            project.type == "service" && <Tab value={ Tabs.environment }>Environment</Tab>
                        }
                        <Tab value={ Tabs.events }>Webhook Events</Tab>
                        <Tab value={ Tabs.log }>Log</Tab>
                    </TabList>

                    {
                        currentTab === Tabs.deploy && <ProjectDeployTab process={mainProcess} status={projectStatus} directUrlHref={ directUrlHref } />
                    }
                    {
                        currentTab === Tabs.install && <ProjectInstallerTab projectId={ projectId }/>
                    }
                    {
                        currentTab === Tabs.environment && <EnvironmentVariableEditor/>
                    }
                    {
                        currentTab === Tabs.events && <ProjectWebhookEventsTab/>
                    }
                    {
                        currentTab === Tabs.log && <ProjectLogTab/>
                    }
                </Stack>
            </Stack>
        </ProjectProvider>
    );
}
