import { makeStyles, Table, TableHeader, TableRow, TableHeaderCell, TableBody, Link, TableCell, TableCellLayout, Tooltip, Text } from "@fluentui/react-components";
import { List, useListRef, type RowComponentProps } from "react-window";
import type { WebhookEvent } from "../../api/api";
import Stack from "../stack";
import { useEffect, useMemo, useRef } from "react";
import { WarningColor } from "@fluentui/react-icons";
import Runtime from "../runtime";
import useTableScrollWidthOffset from "../useTableScrollWidthOffset";

const tableStyles = makeStyles({
    eventCol: {
        minWidth: "8ch"
    },
    idCol: {
        flexGrow: 3,
        minWidth: "36ch"
    },
    commitCol: {
        flexGrow: 1.5,
        minWidth: "16ch"
    },
    senderCol: {
        minWidth: "14ch"
    },
    timeCol: {
        minWidth: "16ch"
    },
});

const headerRowHeight = 33;

export default function WebhookEventList(props: { events: WebhookEvent[], highlightId?: string, style?: React.CSSProperties, }) {
    const styles = tableStyles();
    const list = useListRef(null);
    const _prevEventRef = useRef<string | undefined>(undefined);
    const scrollWidthAlignRef = useTableScrollWidthOffset(list.current?.element);

    useEffect(() => {
        if (props.highlightId != _prevEventRef.current) {
            _prevEventRef.current = props.highlightId;
            if (props.events.length != 0 && props.highlightId) {
                const eventIndex = props.events.findIndex(el => el.id === props.highlightId);
                if (eventIndex == -1) {
                    return;
                }
                list.current?.scrollToRow({
                    behavior: "instant",
                    index: eventIndex
                });
            }
        }
    }, [list, props.events, props.highlightId]);
    
    const { height, minHeight, maxHeight, ...rest } = props.style ?? {};
    const computedHeight = height ? `calc(${height} - ${headerRowHeight}px)` : "auto";
    const computedMaxHeight = maxHeight ? `calc(${maxHeight} - ${headerRowHeight}px)` : "auto";
    const computedMinHeight = minHeight ? `calc(${minHeight} - ${headerRowHeight}px)` : "auto";

    return (
        <Stack horizontalFill verticalFill style={{overflowX: "auto", ...rest}}>
            <Table noNativeElements style={{minWidth: 800}}>
                <TableHeader>
                    <TableRow>
                        <TableHeaderCell className={styles.eventCol}>
                            Event
                        </TableHeaderCell>
                        <TableHeaderCell className={styles.idCol}>
                            ID
                        </TableHeaderCell>
                        <TableHeaderCell className={styles.commitCol}>
                            Commit
                        </TableHeaderCell>
                        <TableHeaderCell className={styles.senderCol}>
                            Sender
                        </TableHeaderCell>
                        <TableHeaderCell className={styles.timeCol}>
                            Time
                        </TableHeaderCell>
                        <div role="presentation" ref={scrollWidthAlignRef} />
                    </TableRow>
                </TableHeader>
                <TableBody
                    style={{
                        overflowY: "auto",
                        width: "100%",
                        height: computedHeight,
                        maxHeight: computedMaxHeight,
                        minHeight: computedMinHeight
                    }}
                >
                    <List
                        rowComponent={RenderItem}
                        rowCount={props.events.length}
                        rowHeight={45}
                        rowProps={{ events: props.events, highlightId: props.highlightId }}
                        listRef={list}
                    />
                </TableBody>
            </Table>
        </Stack> 
    );
}

function RenderItem({ index, style, events, highlightId }: RowComponentProps<{ events: WebhookEvent[], highlightId?: string }>) {
    const event = events[index];
    return (
        <div style={style} key={event.time}><EventRow event={event} highlight={event.id === highlightId}/></div>
    );
}

function EventRow(props: { event: WebhookEvent, highlight?: boolean }) {
    const styles = tableStyles();

    const commitStringRef = useMemo(() => {
        return `${props.event.commit.id?.substring(0, 7)}@${props.event.repository.branch}`
    }, [props.event.commit.id, props.event.repository.branch]);

    return (
        <TableRow appearance={props.highlight ? "neutral" : "none"}>
            <TableCell className={styles.eventCol}>
                <TableCellLayout
                    media={
                        <span>
                            {
                                props.event.security.valid == false &&
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
                    {props.event.type}
                </TableCellLayout>
            </TableCell>
            <TableCell className={styles.idCol}>
                <TableCellLayout>
                    {props.event.id}
                </TableCellLayout>
            </TableCell>
            <TableCell className={styles.commitCol}>
                <TableCellLayout truncate>
                    {
                        props.event.commit.id && <Link href={props.event.commit.url!} target="_blank">{commitStringRef}</Link>
                    }
                </TableCellLayout>
            </TableCell>
            <TableCell className={styles.senderCol}>
                <TableCellLayout truncate>
                    <Link href={props.event.sender.url} target="_blank">{props.event.sender.name}</Link>
                </TableCellLayout>
            </TableCell>
            <TableCell className={styles.timeCol}>
                <Runtime since start={props.event.time}></Runtime>
            </TableCell>
        </TableRow>
    );
}