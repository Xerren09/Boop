import { Text, Link, Tooltip, Table, TableHeaderCell, TableHeader, TableRow, TableBody, TableCell, TableCellLayout, useApplyScrollbarWidth } from "@fluentui/react-components";
import Stack from "../../components/stack";
import { useContext, useEffect, useMemo, useRef, useState, type JSX } from "react";
import Runtime from "../../components/runtime";
import { ProjectProvider, type WebhookEvent } from "../../api/api";
import { WarningColor } from "@fluentui/react-icons";
import Section from "../../components/section";

const HeaderCellDefs: HeaderCell[] = [
    {
        id: "event",
        label: "Event",
    },
    {
        id: "id",
        label: "ID",
    },
    {
        id: "commit",
        label: "Commit",
        style: {
            width: 120
        }
    },
    {
        id: "sender",
        label: "Sender",
        style: {
            width: 120
        }
    },
    {
        id: "time",
        label: "Time",
        style: {
            width: 120
        }
    },
];

const HeaderCells: JSX.Element[] = HeaderCellDefs.map((column) => (
    <TableHeaderCell key={column.id} style={column.style}>
        {column.label}
    </TableHeaderCell>
));

type HeaderCell = {
    id: string,
    label: string,
    style?: React.CSSProperties
}

function ScrollToEventRow(events: WebhookEvent[], eventRef: string) {
    if (eventRef) {
        const eventTimeId = events.find(el => el.id === eventRef)?.time ?? -1;
        if (eventTimeId === -1) {
            return;
        }
        console.log("scrolling to event", eventTimeId);
        const element = document.getElementById(`${eventTimeId}`);
        element?.scrollIntoView();
    }
}

export default function ProjectWebhookEventsTab() {
    const project = useContext(ProjectProvider);
    const [events, setEvents] = useState<WebhookEvent[]>([]);

    const referredEventRef = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("eventRef") ?? "";
    }, []);

    const rows = useMemo(() => {
        return events.reverse().map((event) => (
            <TableRow key={event.time} id={`${event.time}`} appearance={referredEventRef === event.id ? "neutral" : "none"}>
                <TableCell>
                    <TableCellLayout
                        media={
                            <span>
                                {
                                    event.security.valid == false &&
                                        <Tooltip
                                            content={
                                                <Text>Could not verify the authenticty of this event. This may be due to Boop being started with the <code>DISABLE_WEBHOOK_SECURITY</code> environment variable, or if there was no <code>SECRET</code> set.</Text>
                                            } relationship="label"
                                        >
                                            <WarningColor fontSize={20} />
                                        </Tooltip>
                                }
                            </span>
                        }
                        truncate
                    >
                        {event.type}
                    </TableCellLayout>
                </TableCell>
                <TableCell>
                    <TableCellLayout truncate title={event.id}>
                        {event.id}
                    </TableCellLayout>
                </TableCell>
                <TableCell>
                    <TableCellLayout truncate>
                        {
                            event.commit.id ? (
                                <Link href={event.commit.url!} target="_blank">{event.commit.id.substring(0, 7)}@{event.repository.branch}</Link>
                            )
                                :
                            "---"
                        }
                    </TableCellLayout>
                </TableCell>
                <TableCell>
                    <TableCellLayout truncate>
                        <Link href={event.sender.url} target="_blank">{event.sender.name}</Link>
                    </TableCellLayout>
                </TableCell>
                <TableCell>
                    <Runtime since start={event.time}></Runtime>
                </TableCell>
            </TableRow>
        ))
    }, [events, referredEventRef]);

    useEffect(() => {
        async function getEvents() {
            const webhookEvents = await project?.getWebhookLog();
            if (webhookEvents) {
                setEvents(webhookEvents);
            }
        }
        getEvents();
    }, [project]);

    const _shouldScrollToEvent = useRef<boolean>(true);
    useEffect(() => {
        if (events.length != 0 && _shouldScrollToEvent.current && referredEventRef.length != 0) {
            _shouldScrollToEvent.current = false;
            ScrollToEventRow(events, referredEventRef);
        }
        else if (window.location.search.length == 0) {
            _shouldScrollToEvent.current = false;
        }
    }, [events, referredEventRef]);

    const scrollWidthAlignRef = useApplyScrollbarWidth();

    return(
        <Section
            title="Received events"
            style={{
                height: "100%"
            }}
        >
            <Stack horizontalFill verticalFill>
                <Table noNativeElements>
                    <TableHeader>
                        <TableRow>
                            {
                                ...HeaderCells
                            }
                            <div role="presentation" ref={scrollWidthAlignRef} />
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        style={{
                            overflowY: "auto",
                            height: 440,
                            width: "100%"
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