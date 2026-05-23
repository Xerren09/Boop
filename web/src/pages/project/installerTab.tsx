import { useInstallStreamer, type InstallerStatus } from "../../api/streamers/useInstallStreamer";
import Section from "../../components/section";
import Stack from "../../components/stack";
import RemoteProcessGroup, { type CompletedProcess } from "../../components/processGroup";
import { Text } from "@fluentui/react-components";
import ProjectLogSelect from "../../components/projectLogSelect";
import { ProjectProvider, type EventLog } from "../../api/api";
import { useContext, useEffect, useState } from "react";
import StatusIcon from "../../components/statusIcon";

const statusHeadingMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "Installing",
    "error": "Installer failed",
    "ok": "Installer complete",
}

const statusDescriptionMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "This project is currently installing. You can follow the progress below. Once the installer completed, it will be automatically deployed if successful.",
    "error": `The project installer has failed. This means your build is failing; typically you can fix this by pushing a commit to the target branch of your repository.\n\nCheck the log below to see which step failed.`,
    "ok": "The installer completed successfully, and the project is now being deployed."
}

export default function ProjectInstallerTab(props: { projectId: string }) {
    const { steps, status, triggerEvent } = useInstallStreamer(props.projectId);
    const [logTime, setlogTime] = useState<number|null>(null);
    const [logSteps, setLogSteps] = useState<CompletedProcess[]>([]);
    const project = useContext(ProjectProvider);

    // TODO: Add installer ref to the build group subtitle that links to the corresponding webhook event that triggered it

    async function onSelect(file: EventLog | null) {
        console.log(file);
        if (!file) {
            console.log("Live selected");
            setLogSteps([]);
            return;
        }
        if (file.time) {
            setlogTime(() => file.time);
            const log = await project?.getInstallLog(file.time);
            const _steps: CompletedProcess[] = [];
            for (const step of log!.steps) {
                _steps.push({
                    ...step,
                    output: null
                });
            }
            setLogSteps(() => _steps);
        }
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
        if (steps.length == 0 && logSteps.length == 0) {
            console.log("No installer in this session, getting latest log");
            // Pull the latest log as the value of live
            project.listInstallLogs().then(logs => logs.reduce((prev, curr) => prev.time > curr.time ? prev : curr)).then(log => onSelect(log ?? null));
        }
    }, [steps, logSteps]);

    const processList = logSteps.length === 0 ? steps : logSteps;

    return (
        <Stack horizontalFill gap={24}>
            <Section
                title={statusHeadingMap[status]}
                icon={<StatusIcon status={ status } />}
                right={ <ProjectLogSelect install onSelect={onSelect}/> }
            >
                <Text>
                    { statusDescriptionMap[status] }
                </Text>        
            </Section>
            
            <RemoteProcessGroup
                title="Steps"
                subtitle={<Text>{ triggerEvent }</Text>}
                processes={processList}
                onTerminalContentRequest={onTerminalContentRequested}
            />
        </Stack>
    );
}
