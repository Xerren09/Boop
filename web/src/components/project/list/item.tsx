import { Link, TableCell, TableCellActions, TableCellLayout, TableRow } from "@fluentui/react-components";
import Runtime from "../../runtime";
import { useProjectStreamer } from "../../../api/streamers/useProjectStreamer";
import { ProjectStatusIcon } from "../statusIcon";
import { ProjectIcon } from "../typeIcon";
import { Link as RouterLink } from "react-router"; 
import ProjectControlButton from "../controlButton";
import type { ProjectType } from "../../../api/api";

export default function ProjectListItem(props: Props) {
    const { projectStatus, lastWebhookEvent } = useProjectStreamer(props.name);
    
    return (
        <TableRow key={props.name} style={{
            display: props.hidden ? "none" : "table-row"
        }}>
            <TableCell>
                <TableCellLayout media={<ProjectIcon type={props.type} filled />}>
                    <RouterLink to={`/${props.name}`}>
                        {props.name}
                    </RouterLink>
                </TableCellLayout>
                {
                    props.disableActions ? null : (
                        <TableCellActions>
                            <ProjectControlButton action="start" projectState={projectStatus} projectId={props.name} appearance="subtle" hideLabel/>
                            <ProjectControlButton action="stop" projectState={projectStatus} projectId={props.name} appearance="subtle" hideLabel/>
                            <ProjectControlButton action="restart" projectState={projectStatus} projectId={props.name} appearance="subtle" hideLabel/>
                        </TableCellActions>
                    )
                }
            </TableCell>
            <TableCell>
                <ProjectStatusIcon status={ projectStatus } size="tiny"/>
            </TableCell>
            <TableCell>
                {
                    lastWebhookEvent && lastWebhookEvent.commit.url && lastWebhookEvent.commit.id ? <Link href={ lastWebhookEvent.commit.url } target="_blank">{ `${lastWebhookEvent.commit.id.substring(0, 7)}` }</Link> : null
                }
            </TableCell>
            <TableCell>
                {
                    lastWebhookEvent ? <Runtime since start={lastWebhookEvent.time}/> : "never"
                }
            </TableCell>
        </TableRow>
    )
}

type Props = {
    name: string;
    type: ProjectType;
    disableActions?: boolean,
    hidden?: boolean
}