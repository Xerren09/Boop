import { useInstallStreamer, type InstallerStatus } from "../../api/streamers/useInstallStreamer";
import Section from "../../components/section";
import Stack from "../../components/stack";
import RemoteProcessGroup, { type CompletedProcess } from "../../components/processGroup";
import { Field, ProgressBar, Text } from "@fluentui/react-components";
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

    const [selectedFileHandle, setSelectedFileHandle] = useState<EventLog | null>(null);

    const [logTime, setlogTime] = useState<number|null>(null);
    const [logSteps, setLogSteps] = useState<CompletedProcess[]>([]);

    const project = useContext(ProjectProvider);

    // TODO: Add installer ref to the build group subtitle that links to the corresponding webhook event that triggered it

    async function onSelect(file: EventLog | null) {
        if (!file) {
            console.log("Live selected");
            setSelectedFileHandle(null);
            setlogTime(null);
            setLogSteps([]);
            return;
        }
        if (file.time) {
            console.log("Selected file:", file);
            setSelectedFileHandle(file);
            const _steps = await getLogFile(file);
            setlogTime(() => file.time);
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
        if (logSteps.length === 0 || logTime === null) {
            return;
        }
        if (logSteps[idx].output != null) {
            return;
        }
        const _steps = [...logSteps];
        const step = _steps[idx];
        step.output = (await project?.getInstallLog(logTime, idx)) ?? "";
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
                setlogTime(() => log.time);
                setLogSteps(() => _steps);
            }).catch(err => console.error(err));
        }
    }, [steps, selectedFileHandle]);

    const processList = (steps.length > 0 && selectedFileHandle == null) || logSteps.length === 0 ? steps : logSteps;

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
                subtitle={<Text>Triggered by Webhook event { triggerEvent }</Text>}
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