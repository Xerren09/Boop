import Section from "../section";
import Stack from "../stack";
import Terminal from "../terminal";
import { useEffect, useMemo, useState } from "react";
import Runtime from "../runtime";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { RemoteProcess } from "../../api/api";
import StatusIcon, { type Status } from "../statusIcon";

function parseExitCode(val: number | null): Status {
    if (val === null) {
        return "pending";
    }
    else if (val === 0) {
        return "ok";
    }
    else {
        return "warning"
    }
}

function getLastExitIdx(list: RemoteProcess[] | CompletedProcess[]) {
    const faultedIdx = list.findIndex(el => el.exitCode != 0);
    return faultedIdx == -1 ? list.length - 1 : faultedIdx;
}

export default function ProcessGroup(props: Props) {
    const [status, setStatus] = useState<Status>("pending");

    const [startedAt, setStartedAt] = useState<number>(0);
    const [completedAt, setCompletedAt] = useState<number>(0);

    async function handleRemoteProcessArray(list: RemoteProcess[]) {
        if (list.length != 0) {
            const first = list[0];
            const last = list[list.length - 1];
            if (first.dud == false) {
                await firstValueFrom(first.output, { defaultValue: null});
            }
            setStartedAt(() => first.startTime!);
            setCompletedAt(() => 0);
            setStatus(() => "pending");
            // Wait for the chain to complete
            await lastValueFrom(last.output, { defaultValue: null });
            const lastExitedIdx = getLastExitIdx(list);
            const groupStatus = list[lastExitedIdx].exitCode;
            setStatus(() => parseExitCode(groupStatus));
            const groupStopTime = list[lastExitedIdx].exitTime!;
            setCompletedAt(() => groupStopTime);
        }
    }

    useEffect(() => {
        if (props.processes.length > 0) {
            if (props.processes[0] instanceof RemoteProcess) {
                // Disabled because this is an async function
                // eslint-disable-next-line react-hooks/set-state-in-effect
                handleRemoteProcessArray(props.processes as RemoteProcess[]);
            }
        }
    }, [props.processes]);

    const isRemoteProcessArray = (props.processes[0] ?? null) instanceof RemoteProcess;

    const completedProcessListLastProcess = useMemo(() => {
        if (props.processes.length == 0 || (props.processes[0] ?? null) instanceof RemoteProcess) {
            return null;
        }
        return props.processes[getLastExitIdx(props.processes)];
    }, [props.processes])

    const startTime = (isRemoteProcessArray ? startedAt : (props.processes[0]?.startTime)) ?? 0;
    const exitTime = (isRemoteProcessArray ? completedAt : (completedProcessListLastProcess?.exitTime)) ?? 0;
    const groupStatus = (isRemoteProcessArray ? status : parseExitCode(completedProcessListLastProcess?.exitCode ?? null))

    return (
        <Section
            title={props.title}
            icon={
                <StatusIcon size="extra-small" status={ groupStatus } />
            }
            titleExtras={
                // Total runtime in short format
                (startTime !== 0) ? <Runtime start={startTime} end={exitTime != 0 ? exitTime : undefined} short /> : null
            }
            subTitle={
                props.subtitle
            }
            right={
                // Time since completion of the group
                (exitTime !== 0) ? <Runtime since start={exitTime}></Runtime> : null
            }
        >
            <Stack gap={12} horizontalFill>
                {
                    props.processes.map((process, idx) => {
                        if (process instanceof RemoteProcess) {
                            return (
                                <Terminal
                                    key={`${process.cmd}-${idx}`}
                                    title={process.cmd}
                                    startCollapsed
                                    process={process}
                                />
                            )
                        }
                        else {
                            return (
                                <Terminal
                                    key={`${process.cmd}-${idx}`}
                                    title={process.cmd}
                                    startCollapsed
                                    startTime={process.startTime ?? 0}
                                    exitTime={process.exitTime ?? 0}
                                    exitCode={process.exitCode}
                                    stream={process.output}
                                />
                            )
                        }
                    })
                }
            </Stack>
        </Section>
    );
}

interface Props {
    title: string,
    subtitle?: React.ReactNode,
    processes: CompletedProcess[] | RemoteProcess[]
}

export interface CompletedProcess extends Omit<RemoteProcess, "output" | "dispatch" | "dead">{
    output: string;
}