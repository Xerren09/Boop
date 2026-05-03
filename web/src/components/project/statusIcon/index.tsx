import type { ProjectStatus } from "../../../api/streamers/types"
import StatusIcon, { type  StatusIconProps, type Status } from "../../statusIcon";

const statusMap: { [key in NonNullable<ProjectStatus>]: Status } = {
    "deployed": "ok",
    "stopped": "warning",
    "installFailed": "error",
    "installing": "pending"
}

export function ProjectStatusIcon(props: Props) {
    return (
        <StatusIcon size={props.size} status={ props.status === null ? "pending" : statusMap[props.status] } />
    )
}

type Props = {
    status: ProjectStatus,
    size?: StatusIconProps["size"],
}