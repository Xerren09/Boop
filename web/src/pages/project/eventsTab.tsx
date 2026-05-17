import { Text, Link, Tooltip, Table, TableHeaderCell, TableHeader, TableRow, TableBody, TableCell } from "@fluentui/react-components";
import Stack from "../../components/stack";
import { useContext, useEffect, useMemo, useState } from "react";
import Runtime from "../../components/runtime";
import { ProjectProvider, type WebhookEvent } from "../../api/api";
import { WarningColor } from "@fluentui/react-icons";
import Section from "../../components/section";

const HeaderCells: HeaderCell[] = [
    {
        id: "type",
        label: "Type"
    },
    {
        id: "commit",
        label: "Commit"
    },
    {
        id: "sender",
        label: "Sender"
    },
    {
        id: "time",
        label: "Time"
    },
];

type HeaderCell = {
    id: string,
    label: string
}

export default function ProjectWebhookEventsTab() {
    const project = useContext(ProjectProvider);
    const [events, setEvents] = useState<WebhookEvent[]>([]);

    const headerCells = useMemo(() => {
        return HeaderCells.map((column) => (
            <TableHeaderCell key={column.id}>
                {column.label}
            </TableHeaderCell>
        ))
    }, []);

    const rows = useMemo(() => {
        return events.reverse().map((event) => (
            <TableRow key={event.time}>
                <TableCell>
                    <Stack horizontal verticalAlign="center" horizontalFill gap={8}>
                        {
                            event.security.valid == false  && <Tooltip content={<Text>Could not verify the authenticty of this event. This may be due to Boop being started with the <code>DISABLE_WEBHOOK_SECURITY</code> environment variable, or if there was no <code>SECRET</code> set.</Text>} relationship="label"><WarningColor fontSize={20}/></Tooltip>
                        }
                        <Text>{event.type}</Text>
                    </Stack>
                </TableCell>
                <TableCell>
                    {
                        event.commit.id ? (
                            <Link href={event.commit.url!} target="_blank">{event.commit.id}@{event.repository.branch}</Link>
                        )
                            :
                        "---"
                    }
                </TableCell>
                <TableCell>
                    <Link href={event.sender.url} target="_blank">{event.sender.name}</Link>
                </TableCell>
                <TableCell>
                    <Runtime since start={event.time}></Runtime>
                </TableCell>
            </TableRow>
        ))
    }, [events]);

    useEffect(() => {
        async function getEvents() {
            const webhookEvents = await project?.getWebhookLog();
            if (webhookEvents) {
                setEvents(webhookEvents);
            }
        }
        getEvents();
    }, [project]);

    return(
        <Section
            style={{
                marginBottom: 22,
                height: "100%"
            }}
        >
            <Stack horizontalFill verticalFill>
                <Table noNativeElements >
                    <TableHeader>
                        <TableRow>
                            {
                                ...headerCells
                            }
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        style={{
                            display: "block",
                            overflowY: "scroll",
                            height: 440
                        }}
                    >
                        {
                            ...rows
                        }
                    </TableBody>
                </Table>
            </Stack> 
        </Section>
    )
}