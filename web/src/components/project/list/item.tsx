import { Link, Menu, MenuButton, MenuList, MenuPopover, MenuTrigger, TableCell, TableCellActions, TableCellLayout, TableRow } from "@fluentui/react-components";
import Runtime from "../../runtime";
import { useProjectStreamer } from "../../../api/streamers/useProjectStreamer";
import { ProjectStatusIcon } from "../statusIcon";
import { useNavigate } from "react-router"; 
import ProjectControlButton from "../controlButton";
import { BoopAPI, type ProjectType } from "../../../api/api";
import { MoreHorizontalFilled } from "@fluentui/react-icons";
import { useMemo } from "react";

export default function ProjectListItem(props: Props) {
    const url = useMemo(() => {
        const base = BoopAPI.constructApiURL(`projects/${props.name}`);
        base.protocol = "ws:"
        return base;
    }, [props.name]);
    const nav = useNavigate();

    const { projectStatus, lastWebhookEvent } = useProjectStreamer(url);
    
    const disable = projectStatus === "disposed";

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
                    <Link disabled={disable} onClick={() => { nav(`/${props.name}`) }} style={{textDecoration: "none"}}>{props.name}</Link>
                </TableCellLayout>
                {
                    props.disableActions || disable ? null : (
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
                <TableCellLayout truncate>
                    {
                        lastWebhookEvent && lastWebhookEvent.commit.url && lastWebhookEvent.commit.id ? <Link href={ lastWebhookEvent.commit.url } target="_blank">{ `${lastWebhookEvent.commit.id.substring(0, 7)}` }</Link> : null
                    }                    
                </TableCellLayout>
            </TableCell>
            <TableCell>
                <TableCellLayout truncate>
                    {
                        lastWebhookEvent ? <Runtime since start={lastWebhookEvent.time}/> : "never"
                    }
                </TableCellLayout>
            </TableCell>
        </TableRow>
    )
}

type Props = {
    name: string;
    type: ProjectType;
    disableActions?: boolean;
    hidden?: boolean;
}