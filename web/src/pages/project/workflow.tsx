import { Icon, Spinner, SpinnerSize, Stack, Text } from "@fluentui/react";
import { useEffect, useRef, useState } from "react";
import { BuildLogSelect } from "../../components/buildLogSelector";
import { SectionComponent } from "../../components/section";
import { Terminal } from "../../components/terminal";
import TimeAgo from 'react-timeago';
import { v4 as uuidv4 } from 'uuid';

export function ProjectWorkflow(props: { projectType: "webapp" | "service" | null, projectName: string, onStatusChange?: () => void }) {
    
    const ws = useRef<WebSocket | undefined>();

    const [deployInfo, setDeployInfo] = useState<DeployInfo>(
        {
            deployed: null,
            time: null,
            output: [],
            exitCode: null
        }
    );

    const [installer, setInstaller] = useState<InstallerInfo>(
        {
            result: null,
            time: null,
        }
    );

    const [steps, setSteps] = useState<InstallerStep[]>([]);

    useEffect(() => {
        if (ws.current === undefined || ws.current.readyState > 1) {
            ws.current = new WebSocket(`ws://localhost:8004/boop/api/projects/${props.projectName}/installer`);
            ws.current.addEventListener("message", (message) => {
                if (message.data) {
                    ProcessTerminalMessage(message.data);
                }
            });
        }
        return () => {
            ws.current?.close();
        }
    }, [props.projectName]);

    function ProcessTerminalMessage(rawMessage: string) {
        const message: TerminalMessage = JSON.parse(rawMessage) as TerminalMessage;
        switch (message.type) {
            case "deploy":
                setDeployInfo({
                    exitCode: message.exit,
                    output: [...message.output.map(el => el.line)],
                    deployed: message.deployed,
                    time: message.time ? new Date(message.time) : null,
                });
                if (props.onStatusChange) {
                    props.onStatusChange();
                }
                break;
            case "projectOut":
                setDeployInfo(_info => ({
                    ..._info,
                    output: [..._info.output, ...message.output.map(el => el.line)],
                }));
                break;
            case "installer":
                setInstaller(_inst => ({
                    result: null,
                    time: new Date(Date.now())
                }));
                setSteps(message.steps.map(el => ({
                    cmd: el,
                    key: uuidv4(),
                    output: [],
                    exitCode: null,
                })));
                break;
            case "installerHistory":
                setInstaller(_inst => ({
                    time: new Date(message.time),
                    result: message.log.every(el => el.exit === 0) === true ? "success" : "error"
                }));
                setSteps(message.log.map(el => ({
                    cmd: el.cmd,
                    key: uuidv4(),
                    output: [...el.output.map(line => line.line)],
                    exitCode: el.exit
                })));
                break;
            case "installerComplete":
                setInstaller(_inst => ({
                    ..._inst,
                    result: message.success ? "success" : "error",
                }));
                break;
            case "stepOut":
                setSteps(_steps => [..._steps.map(step => ({
                    ...step,
                    output: step.cmd === message.cmd ? [...step.output, ...message.output.map(line => line.line)] : step.output,
                }))]);
                break;
            case "stepComplete":
                setSteps(_steps => [..._steps.map(step => ({
                    ...step,
                    exitCode: message.exit,
                }))]);
                break;
            default:
                break;
        }
    }

    function onLogSelectionChange(time: number) {
        fetch(`http://localhost:8004/boop/api/projects/${props.projectName}/logs?time=${time}`).then(res => {
            if (res.ok) {
                res.text().then(msg => {
                    ProcessTerminalMessage(msg);
                });
            }
        });
    }

    return (
        <Stack style={{width: "100%"}} tokens={{childrenGap: 24}}>
            <SectionComponent
                title="Deploy"
                titleExtras={
                    deployInfo.deployed == null ?
                    <Spinner size={SpinnerSize.medium}></Spinner>
                    :
                    (
                        deployInfo.deployed === true ?
                            <Icon iconName="SkypeCircleCheck" style={{ color: "#7FBA00", width: 16, height: 16, userSelect: "none" }}></Icon>
                            :
                            <Icon iconName="StatusErrorFull" style={{ color: "#ff3333", width: 16, height: 16, userSelect: "none" }}></Icon>
                    )
                }
                subTitle={
                    <Text variant="small">{ deployInfo.time === null ? "never" : <TimeAgo date={deployInfo.time}></TimeAgo> }</Text>
                }
            >
                {
                    props.projectType === "service" ? 
                        <Terminal exitCode={deployInfo.exitCode} source={deployInfo.output} collapsed autoClear></Terminal>
                        :
                        undefined
                }
                {
                    props.projectType === "webapp" ? 
                        (deployInfo.deployed === true ? <Text>Project successfully deployed via appRouter.</Text> : <Text>Project router could not be created. Check boop.log for more info.</Text>)
                        :
                        undefined
                }
            </SectionComponent>

            <SectionComponent
                title="Build"
                titleExtras={
                    installer.result == null ?
                        <Spinner size={SpinnerSize.medium}></Spinner>
                        :
                        (
                            installer.result === "success" ?
                                <Icon iconName="SkypeCircleCheck" style={{ color: "#7FBA00", width: 16, height: 16, userSelect: "none" }}></Icon>
                                :
                                <Icon iconName="StatusErrorFull" style={{ color: "#ff3333", width: 16, height: 16, userSelect: "none" }}></Icon>
                        )
                }
                subTitle={
                    <Text variant="small">{installer.time === null ? "never" : <TimeAgo date={installer.time}></TimeAgo>}</Text>
                }
                right={
                    <BuildLogSelect
                        source={`http://localhost:8004/boop/api/projects/${props.projectName}`}
                        onSelect={ (val) => { onLogSelectionChange(val) }}
                    ></BuildLogSelect>
                }
            >
                <Stack tokens={{childrenGap: 12}} style={{width: "100%"}}>
                    {
                        steps.map(el => (
                            <Terminal key={el.key} title={el.cmd} exitCode={ el.exitCode } source={el.output} collapsed autoClear></Terminal>
                        ))
                    }
                </Stack>
            </SectionComponent>
        </Stack>
    );
}

interface DeployInfo {
    deployed: null | boolean,
    time: Date | null,
    exitCode: number | null,
    output: string[]
}

interface InstallerInfo {
    result: null | "error" | "success",
    time: Date | null,
}

export interface InstallerStep {
    cmd: string,
    key: string,
    exitCode: number | null,
    output: string[],
}

type TerminalMessage = {
    type: "deploy",
    deployed: boolean,
    exit: null | number,
    time: null | number,
    output: TerminalLine[]
} | {
    type: "installer",
    steps: string[]
} | {
    type: "installerHistory",
    time: number,
    log: TerminalHistory[]
} | {
    type: "installerComplete",
    success: boolean
} | {
    type: "stepOut",
    cmd: string,
    output: TerminalLine[]
} | {
    type: "stepComplete",
    cmd: string,
    exit: number
} | {
    type: "projectOut",
    output: TerminalLine[]
}

export type TerminalMessageType = TerminalMessage["type"];

interface TerminalLine {
    stream: "stdout" | "stderr", 
    line: string
}

interface TerminalHistory {
    cmd: string,
    exit: number,
    output: TerminalLine[]
}