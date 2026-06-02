import { useInstallStreamer, type InstallerStatus } from "../../api/streamers/useInstallStreamer";
import Section from "../../components/section";
import Stack from "../../components/stack";
import RemoteProcessGroup, { type CompletedProcess } from "../../components/processGroup";
import { Caption1, Field, ProgressBar, Text } from "@fluentui/react-components";
import ProjectLogSelect from "../../components/projectLogSelect";
import { ProjectProvider, RemoteProcess, type EventLog } from "../../api/api";
import { useContext, useEffect, useState } from "react";
import StatusIcon from "../../components/statusIcon";
import { lastValueFrom } from "rxjs";

const statusHeadingMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "Building",
    "error": "Build failed",
    "ok": "Build complete",
}

const statusDescriptionMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "This project is currently building. You can follow the progress below. Once the project has been successfully built, the project will be automatically deployed.",
    "error": `The project build has failed. This means your build is failing; typically you can fix this by pushing a commit to the target branch of your repository.\n\nCheck the log below to see which step failed.`,
    "ok": "The project build completed successfully, and the project is now being deployed."
}

export default function ProjectInstallerTab(props: { projectId: string }) {
    const { steps, status, triggerEvent } = useInstallStreamer(props.projectId);

    const [isLive, setLiveStatus] = useState<boolean>(true);
    const [selectedFileHandle, setSelectedFileHandle] = useState<EventLog | null>(null);
    const [logSteps, setLogSteps] = useState<CompletedProcess[]>([]);

    const project = useContext(ProjectProvider);

    async function onSelect(file: EventLog | null) {
        if (!file) {
            console.log("Live selected");
            setLiveStatus(true);
            setSelectedFileHandle(null);
            setLogSteps([]);
            return;
        }
        if (file.time) {
            console.log("Selected file:", file);
            setLiveStatus(false);
            setSelectedFileHandle(file);
            const _steps = await getLogFile(file);
            setLogSteps(() => _steps);
        }
    }

    async function getLogFile(file: EventLog) {
        const log = await project?.getInstallLog(file.time);
        const _steps: CompletedProcess[] = [];
        for (const step of log!.steps) {
            _steps.push({
                ...step,
                output: null
            });
        }
        return _steps;
    }

    async function onTerminalContentRequested(idx: number) {
        if (logSteps.length === 0 || selectedFileHandle === null) {
            return;
        }
        if (logSteps[idx].output != null) {
            return;
        }
        const _steps = [...logSteps];
        const step = _steps[idx];
        step.output = (await project?.getInstallLog(selectedFileHandle.time, idx)) ?? "";
        setLogSteps(() => _steps);
    }

    /**
     * If the project didn't have an installer run yet in this Boop session, read the latest logged installer
     */
    useEffect(() => { 
        if (!project) {
            return;
        }
        if (steps.length == 0 && selectedFileHandle == null && logSteps.length == 0) {
            console.log("No installer in this session, getting latest log");
            // Pull the latest log as the value of live
            project.listInstallLogs().then(logs => logs.reduce((prev, curr) => prev.time > curr.time ? prev : curr)).then(async log => {
                const _steps = await getLogFile(log);
                setSelectedFileHandle(() => log);
                setLogSteps(() => _steps);
            }).catch(err => console.error(err));
        }
    }, [steps, selectedFileHandle]);

    const liveHasContent = (steps.length > 0 && selectedFileHandle == null);

    const eventRef = liveHasContent && isLive ? triggerEvent : selectedFileHandle?.eventReference;
    const processList = liveHasContent && isLive ? steps : logSteps;

    return (
        <Stack horizontalFill gap={24}>
            <Section
                title={statusHeadingMap[status]}
                icon={<StatusIcon status={ status } />}
                right={ <ProjectLogSelect install onSelect={onSelect} style={{ width: "35%", minWidth: 120, maxWidth: 190}}/> }
            >
                <Stack gap={8}>
                    <Text>
                        { statusDescriptionMap[status] }
                    </Text>
                    {
                        status === "pending" && steps.length > 0 &&
                        <InstallerProgressBar processes={steps}/>
                    }
                </Stack>
            </Section>
            
            <RemoteProcessGroup
                title="Steps"
                subtitle={
                    eventRef && <Caption1>Triggered by event {eventRef}</Caption1>
                }
                processes={processList}
                onTerminalContentRequest={onTerminalContentRequested}
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