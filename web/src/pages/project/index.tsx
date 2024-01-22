import { CommandBar, ICommandBarItemProps, Icon, Link, Stack, Text, Panel, PanelType, Modal, ActionButton } from "@fluentui/react";
import { useEffect, useState } from "react";
import TimeAgo from 'react-timeago';
import { ProjectWebhookEvents } from "./events";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../../components/dataTable";
import { ProjectWorkflow } from "./workflow";
import { getApiString, getProxyString } from "../../util";
import { EnvironmentVariableEditor } from "./variables";
import { SectionComponent } from "../../components/section";

export function ProjectPage() {
    const { projectId } = useParams();
    const navigation = useNavigate();

    const [projectInfo, setProjectInfo] = useState<ProjectState>({
        type: null,
        remote: "",
        lastDeploy: null,
        lastEvent: null,
        events: []
    });
    const [showEventsPanel, setEventsPanelVisibility] = useState<boolean>(false);
    const [showEnvEditor, setEnvEditorVisibility] = useState<boolean>(false);

    useEffect(() => {
        window.document.title = `Boop - ${projectId}`;
        getProjectInfo();
    }, [projectId]);

    const commandBarItems: ICommandBarItemProps[] = [
        {
            key: 'start',
            text: 'Start',
            iconProps: { iconName: 'Play' },
            onClick: () => {
                fetch(`${getApiString()}/projects/${projectId}/start`, {
                    method: 'POST'
                });
            },
        },
        {
            key: 'restart',
            text: 'Restart',
            iconProps: { iconName: 'RepeatAll' },
            onClick: () => {
                fetch(`${getApiString()}/projects/${projectId}/restart`, {
                    method: 'POST'
                });
            },
        },
        {
            key: 'stop',
            text: 'Stop',
            iconProps: { iconName: 'Stop' },
            onClick: () => {
                fetch(`${getApiString()}/projects/${projectId}/stop`, {
                    method: 'POST'
                });
            },
        },
    ]

    const commandBarFarItems: ICommandBarItemProps[] = [
        {
            key: 'delete',
            text: 'Delete',
            iconProps: { iconName: 'Delete' },
            onClick: () => {
                fetch(`${getApiString()}/projects/${projectId}`, {
                    method: 'DELETE'
                });
            },
        }
    ]


    function getProjectInfo() {
        fetch(`${getApiString()}/projects/${projectId}`).then(res => {
            if (res.ok) {
                res.json().then((projectData: ProjectInfo) => {
                    setProjectInfo({
                        remote: projectData.remote,
                        type: projectData.type,
                        lastEvent: projectData.events.length !== 0 ? projectData.events[projectData.events.length - 1].time : null,
                        lastDeploy: projectData.lastDeployed ? new Date(projectData.lastDeployed) : null,
                        events: projectData.events
                    });
                });
            }
            else {
                navigation("..");
            }
        });
    }
    
    return (
        <Stack horizontalAlign="start">
            <ActionButton
                iconProps={{ iconName: "Back" }}
                style={{ marginBottom: 12 }}
                onClick={() => {
                    navigation("..");
                }}
            >
                Back
            </ActionButton>
            <Stack style={{width: "100%"}} tokens={{childrenGap: 24}}>
                <SectionComponent>
                    <Stack horizontal horizontalAlign="start" tokens={{childrenGap: 12}}>
                        <Icon iconName={ projectInfo.type === "webapp" ? "Website" : "CommandPrompt"} style={{width: 36, height: 36, fontSize: 36}}></Icon>
                        <Text variant="xLarge">{projectId || ""}</Text>
                    </Stack>
                    <div style={{marginTop: 12, width: "100%"}}>
                        <CommandBar
                            items={commandBarItems}
                            //farItems={commandBarFarItems}
                            style={{marginLeft: -24, marginRight: -14}}
                        />
                    </div>
                    <DataTable
                        rows={[
                            {
                                label: "Remote",
                                content: <Text><Link href={projectInfo.remote} target="_blank">{projectInfo.remote}</Link></Text>
                            },
                            {
                                label: "Host",
                                content: <Text><Link href={getProxyString(projectId!)} target="_blank">{getProxyString(projectId!)}</Link></Text>
                            },
                            {
                                label: "Deployed",
                                content: <Text>{ projectInfo.lastDeploy === null ? "never" : <TimeAgo date={projectInfo.lastDeploy}></TimeAgo> }</Text>
                            },
                            {
                                label: "Last Event",
                                content: <Text><Link onClick={ () => { setEventsPanelVisibility(true) } }>{ projectInfo.lastEvent === null ? "never" : <TimeAgo date={projectInfo.lastEvent}></TimeAgo> }</Link></Text>
                            },
                            {
                                label: "Environment",
                                content: <Text><Link onClick={ () => { setEnvEditorVisibility(true) } }>Edit variables</Link></Text>
                            }
                        ]}
                    />
                </SectionComponent>
            
                {
                    projectId ? <ProjectWorkflow projectType={projectInfo.type} onStatusChange={() => {getProjectInfo()}} projectName={projectId!}></ProjectWorkflow> : undefined
                }
            </Stack>

            {
                // Popover elements
            }

            <Panel
                headerText="Webhook Events"
                isOpen={showEventsPanel}
                type={PanelType.medium}
                onDismiss={() => { setEventsPanelVisibility(false) }}
                closeButtonAriaLabel="Close"
            >
                <ProjectWebhookEvents events={[...projectInfo.events].reverse()}></ProjectWebhookEvents>
            </Panel>

            {
                projectId ? 
                    <Modal
                        isBlocking
                        isOpen={showEnvEditor}
                        onDismiss={() => { setEnvEditorVisibility(false) }}
                    >
                        <EnvironmentVariableEditor projectId={projectId} dismiss={() => { setEnvEditorVisibility(false) }}></EnvironmentVariableEditor>
                    </Modal>
                    :
                    undefined
            }      
        </Stack>
    );
}

interface ProjectState {
    type: null | "webapp" | "service";
    remote: string;
    lastDeploy: null | Date;
    lastEvent: null | Date;
    events: any[];
}

interface ProjectInfo {
    name: string,
    deployed: boolean,
    lastDeployed: number | null,
    remote: string,
    type: "webapp" | "service",
    events: any[]
}