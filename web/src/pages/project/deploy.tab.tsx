import { useContext, useState } from "react";
import { ProjectProvider, RemoteProcess, type EventLog } from "../../api/api";
import { Link, Text } from "@fluentui/react-components";
import type { ProjectStatus } from "../../api/streamers/types";
import Stack from "../../components/stack";
import RemoteProcessGroup from "../../components/process/group";
import { ProjectStatusIcon } from "../../components/project/statusIcon";
import ProjectLogSelect from "../../components/project/logSelect/projectLogSelect";
import ProjectTabLink from "./tabs/tabLink";
import { ProjectTab } from "./tabs/projectTabs.enum";
import useProjectHistory from "../../components/project/logSelect/useProjectHistory";
import { StatusDescription, StatusDescriptionItem } from "../../components/statusDescription";

const statusHeadingMap: { [key in NonNullable<ProjectStatus>]: string } = {
    "deployed": "Deployed",
    "installing": "Installing",
    "installFailed": "Installer failed",
    "installSuccess": "Installer complete",
    "stopped": "Stopped",
    "error": "Error",
    "disposed": "Project unavailable"
}

export default function ProjectDeployTab(props: { status: ProjectStatus, process?: RemoteProcess | null, directUrlHref?: string }) {
    const project = useContext(ProjectProvider);

    const [selectedFileHandle, setSelectedFileHandle] = useState<EventLog | null>(null);
    const { processes, requestProcessOutput } = useProjectHistory("deploy", selectedFileHandle);

    function OnLogSelect(file: EventLog | null) {
        if (!file) {
            console.log("Live selected");
            setSelectedFileHandle(null);
            return;
        }
        if (file.time) {
            console.log("Selected file:", file);
            setSelectedFileHandle(file);
        }
    }

    const proxyUrl = project!.proxyUrl.toString();

    if (!props.status || !project) {
        return null;
    }

    const useLog = selectedFileHandle != null;
    const processArr = useLog ? processes : [props.process!];

    return (
        <Stack horizontalFill gap={24}>
            <StatusDescription
                title={statusHeadingMap[props.status]}
                icon={<ProjectStatusIcon status={props.status} />}
                selectedItem={props.status}
            >
                <StatusDescriptionItem<ProjectStatus> value={"deployed"} >
                    <Text>
                        This project is currently deployed. You can access it via Boop's HTTP proxy at <Link href={proxyUrl}>{proxyUrl}</Link>{props.directUrlHref && <Text> or directly at <Link href={props.directUrlHref}> {props.directUrlHref} </Link></Text>}.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"stopped"} >
                    <Text>
                        This project is currently stopped, and unavailable for other services. To deploy the project, click <em>Start</em>.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"error"} >
                    <Text>
                        This project is currently stopped due to an error.
                        {
                            props.process && <Text> Check the terminal window below to see what went wrong, or the <ProjectTabLink target={ProjectTab.Build}><em>build</em></ProjectTabLink> tab for further information. </Text>
                        }
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"installing"} >
                    <Text>
                        This project is currently building. You can follow the progress using the <ProjectTabLink target={ProjectTab.Build}><em>build</em></ProjectTabLink> tab. Once the build completed, it will be automatically deployed if successful.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"installFailed"} >
                    <Text>
                        The project installer has failed. This usually means your build is failing. Typically you can fix it by pushing a commit to the target branch of your repository.
                
                        Check the <ProjectTabLink target={ProjectTab.Build}><em>build</em></ProjectTabLink> tab to see what went wrong.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"installSuccess"} >
                    <Text>
                        This project has just been built, and will be deployed momentarily. Check the build logs via the <ProjectTabLink target={ProjectTab.Build}><em>build</em></ProjectTabLink> tab, or stay here to wait for deployment information.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<ProjectStatus> value={"disposed"} >
                    <Text>
                        The project was unloaded by Boop. This either means Boop is shutting down, or the project was deleted.
                    </Text>
                </StatusDescriptionItem>
            </StatusDescription>
            
            {
                props.process ?
                    <RemoteProcessGroup
                        title="Service"
                        processes={processArr}
                        onTerminalContentRequest={useLog ? requestProcessOutput : undefined}
                        right={
                            props.process ? 
                                <ProjectLogSelect build onSelect={OnLogSelect} style={{ width: "35%", minWidth: 120, maxWidth: 190 }} />
                            : undefined
                        }
                    /> : null
            }
        </Stack>    
    );
}