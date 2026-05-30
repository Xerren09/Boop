import { Text } from "@fluentui/react-components";
import { ChevronRightRegular, ChevronDownRegular } from '@fluentui/react-icons';
import Stack from "../stack";
import Runtime from "../runtime";
import type { Status } from "../statusIcon";
import StatusIcon from "../statusIcon";

function getStatusFromExitCode(code: number | null): Status {
    if (code === null) {
        return "pending"
    }
    else if (code !== 0) {
        return "error"
    }
    return "ok"
}

export default function TerminalHeader(props: HeaderProps) {

    function onCollapseClick() {
        props.onCollapse(!props.collapsed);
    }

    return (
        <Stack
            horizontal
            horizontalAlign="space-between"
            verticalAlign="center"
            style={{ borderBottomColor: props.collapsed ? "transparent" : "black", borderBottomWidth: 1, borderBottomStyle: "solid", width: "100%" }}
        >
            <Stack
                horizontal
                horizontalFill
                verticalAlign="center"
                gap={8}
                style={{
                    padding: 8,
                    minWidth: 0
                }}
            >
                {
                    <StatusIcon size="extra-tiny" status={ getStatusFromExitCode(props.exitCode) } />
                }
                <Text title={props.title || "Terminal Output"} style={{ color: "#dddddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.title || "Terminal Output"}</Text>
            </Stack>
            <Stack
                horizontal
                gap={8}
                verticalAlign="center"
            >
                {
                    props.startTime !== undefined ? <Runtime short start={props.startTime} end={props.exitCode == null ? undefined :  props.exitTime} style={{color: "#dddddd"}}></Runtime> : null
                }
                {
                    props.collapsed ? 
                        <ChevronRightRegular
                            onClick={ onCollapseClick }
                            fontSize={16}
                            style={{ color: "#dddddd", width: 16, height: 16, userSelect: "none", paddingRight: 12, paddingLeft: 12, paddingTop: 8, paddingBottom: 8 }}
                        />
                    :
                        <ChevronDownRegular
                            onClick={ onCollapseClick }
                            fontSize={16}
                            style={{ color: "#dddddd", width: 16, height: 16, userSelect: "none", paddingRight: 12, paddingLeft: 12, paddingTop: 8, paddingBottom: 8 }}
                        />
                }
            </Stack>
        </Stack>
    );
}

interface HeaderProps {
    exitCode: number | null,
    title: string | undefined,
    collapsed: boolean,
    onCollapse: (collapsed: boolean) => void,
    startTime?: number | Date,
    exitTime?: number | Date
}