import { useInstallStreamer, type InstallerStatus } from "../../api/streamers/useInstallStreamer";
import Stack from "../../components/stack";
import RemoteProcessGroup from "../../components/process/group";
import { Caption1, Field, ProgressBar, Text } from "@fluentui/react-components";
import ProjectLogSelect from "../../components/project/logSelect/projectLogSelect";
import { ProjectProvider, RemoteProcess, type EventLog } from "../../api/api";
import { useContext, useEffect, useState } from "react";
import StatusIcon from "../../components/statusIcon";
import { lastValueFrom } from "rxjs";
import ProjectTabLink from "./tabs/tabLink";
import { ProjectTab } from "./tabs/tabs.enum";
import useProjectHistory from "../../components/project/logSelect/useProjectHistory";
import { StatusDescription, StatusDescriptionItem } from "../../components/statusDescription";

const statusHeadingMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "Building",
    "error": "Build failed",
    "ok": "Build complete",
}

export default function ProjectInstallerTab(props: { projectId: string }) {
    const project = useContext(ProjectProvider);
    const { steps, status, triggerEvent } = useInstallStreamer(props.projectId);

    const [isLive, setLiveStatus] = useState<boolean>(true);
    const [selectedFileHandle, setSelectedFileHandle] = useState<EventLog | null>(null);
    const { processes, requestProcessOutput } = useProjectHistory("build", selectedFileHandle);

    async function onSelect(file: EventLog | null) {
        if (!file) {
            console.log("Live selected");
            setLiveStatus(true);
            setSelectedFileHandle(null);
            return;
        }
        if (file.time) {
            console.log("Selected file:", file);
            setLiveStatus(false);
            setSelectedFileHandle(file);
        }
    }

    /**
     * If the project didn't have an installer run yet in this Boop session, read the latest logged installer
     */
    useEffect(() => { 
        if (!project) {
            return;
        }
        if (steps.length == 0 && selectedFileHandle == null) {
            console.log("No installer in this session, getting latest log");
            // Pull the latest log as the value of live
            project.listInstallLogs().then(logs => {
                if (logs.length == 0) {
                    throw "No logs available";
                }
                return logs;
            }).then(logs => logs.reduce((prev, curr) => prev.time > curr.time ? prev : curr)).then(async log => {
                if (log) {
                    setSelectedFileHandle(() => log);
                }
            }).catch(err => console.error(err));
        }
    }, [steps, selectedFileHandle, project]);

    const shouldUseLiveBackup = steps.length == 0 && selectedFileHandle != null && isLive == true;
    
    const eventRef = !shouldUseLiveBackup && isLive ? triggerEvent : selectedFileHandle?.eventReference;
    const processList = !shouldUseLiveBackup && isLive ? steps : processes;

    return (
        <Stack horizontalFill gap={24}>
            <StatusDescription
                title={statusHeadingMap[status]}
                icon={<StatusIcon status={ status } />}
                selectedItem={status}
            >
                <StatusDescriptionItem<InstallerStatus> value={"ok"}>
                    <Text>
                        The project build completed successfully, and the project is now being deployed.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<InstallerStatus> value={"error"}>
                    <Text>
                        The project build has failed. This means your build is failing; typically you can fix this by pushing a commit to the target branch of your repository.
                    </Text>
                    <Text>
                        Check the log below to see which step failed.
                    </Text>
                </StatusDescriptionItem>
                <StatusDescriptionItem<InstallerStatus> value={"pending"}>
                    <Stack gap={8}>
                        <Text>
                            This project is currently building. You can follow the progress below. Once the project has been successfully built, the project will be automatically deployed.
                        </Text>
                        { steps.length > 0 && <InstallerProgressBar processes={steps}/>}
                    </Stack>
                </StatusDescriptionItem>
            </StatusDescription>
            
            <RemoteProcessGroup
                title="Steps"
                subtitle={
                    eventRef && <Caption1>Triggered by event <ProjectTabLink target={ProjectTab.Events} params={{eventRef: eventRef}}>{ eventRef }</ProjectTabLink></Caption1>
                }
                right={ <ProjectLogSelect install onSelect={onSelect} style={{ width: "35%", minWidth: 120, maxWidth: 190}}/> }
                processes={processList}
                onTerminalContentRequest={(shouldUseLiveBackup || isLive == false) ? requestProcessOutput : undefined}
            />
        </Stack>
    );
}

function InstallerProgressBar(props: { processes: RemoteProcess[] }) {
    const [stepIndex, setStep] = useState<number>(0);

    useEffect(() => {
        async function iterate() {
            for (let index = 0; index < props.processes.length; index++) {
                const process = props.processes[index];
                setStep(() => index);
                await lastValueFrom(process.output, { defaultValue: null});
            }
        }
        iterate();
    }, [props.processes]);

    return (
        <Field label="Build progress">
            <ProgressBar max={props.processes.length} value={stepIndex}/>
        </Field>
    );
}