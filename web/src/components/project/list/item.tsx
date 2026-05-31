import { Link, Menu, MenuButton, MenuList, MenuPopover, MenuTrigger, TableCell, TableCellActions, TableCellLayout, TableRow } from "@fluentui/react-components";
import Runtime from "../../runtime";
import { useProjectStreamer } from "../../../api/streamers/useProjectStreamer";
import { ProjectStatusIcon } from "../statusIcon";
import { Link as RouterLink } from "react-router"; 
import ProjectControlButton from "../controlButton";
import type { ProjectType } from "../../../api/api";
import { MoreHorizontalFilled } from "@fluentui/react-icons";

export default function ProjectListItem(props: Props) {
    const { projectStatus, lastWebhookEvent } = useProjectStreamer(props.name);
    
    return (
        <TableRow key={props.name} style={{
            display: props.hidden ? "none" : "table-row"
        }}>
            <TableCell>
                <TableCellLayout
                    media={<ProjectStatusIcon status={ projectStatus } size="tiny"/>}
                    description={props.type === "service" ? "Service" : "Web application"}
                    truncate
                >
                    <RouterLink to={`/${props.name}`}>
                        {props.name}
                    </RouterLink>
                </TableCellLayout>
                {
                    props.disableActions ? null : (
                        <TableCellActions>
                            <Menu>
                                <MenuTrigger disableButtonEnhancement>
                                    <MenuButton appearance="subtle" icon={<MoreHorizontalFilled />}/>
                                </MenuTrigger>
                                <MenuPopover>
                                    <MenuList>
                                        <ProjectControlButton action="start" projectState={projectStatus} projectId={props.name} appearance="subtle" asMenuItem/>
                                        <ProjectControlButton action="stop" projectState={projectStatus} projectId={props.name} appearance="subtle" asMenuItem/>
                                        <ProjectControlButton action="restart" projectState={projectStatus} projectId={props.name} appearance="subtle" asMenuItem/>
                                    </MenuList>
                                </MenuPopover>
                            </Menu>
                        </TableCellActions>
                    )
                }
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