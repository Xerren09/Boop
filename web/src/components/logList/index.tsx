import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Text } from "@fluentui/react-components";
import type { LogEntry } from "../../api/api";
import { BugRegular, DismissCircleColor, InfoRegular, WarningColor } from "@fluentui/react-icons";
import Stack from "../stack";
import Runtime from "../runtime";
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from "react-window";
import { useEffect, useRef } from "react";

export default function LogList(props: { log: LogEntry[] }) {
    const list = useListRef(null);
    const _scrolled = useRef(false);
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: 44
    });
    useEffect(() => {
        // Scroll to bottom of the list on mount
        if (_scrolled.current) {
            return;
        }
        if (props.log.length < 1) {
            return;
        }
        list.current?.scrollToRow({
            behavior: "instant",
            index: props.log.length-1
        });
        _scrolled.current = true;
    }, [props.log]);
    return (
        <Accordion multiple collapsible style={{maxHeight: "inherit"}}>
            <List
                rowComponent={RenderItem}
                rowCount={props.log.length}
                rowHeight={rowHeight}
                rowProps={{ items: props.log }}
                style={{ maxHeight: "inherit" }}
                listRef={list}
            /> 
        </Accordion> 
    );
}

function RenderItem({
    index,
    style,
        items
    }: RowComponentProps<{
        items: LogEntry[];
    }>) {
    
    return (
        <div style={style}><LogItem item={items[index]} accordionId={`${index}`}/></div>
    );
}

function LogItem(props: { item: LogEntry, accordionId: string }) {
    const isMetadataEmpty = Object.keys(props.item.metadata).length == 1;
    const { timestamp, ...metadata } = props.item.metadata;
    if (isMetadataEmpty) {
        return (
            <Stack gap={8} horizontal horizontalFill horizontalAlign="space-between" verticalAlign="center" style={{ paddingLeft: 10, paddingRight: 10, minHeight: 44}}>
                <Stack gap={8} horizontal verticalAlign="center" style={{minWidth: 0}}>
                    <LogItemIcon level={props.item.level} />
                    <Text style={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%"}}>{ props.item.message }</Text>
                </Stack>
                <Runtime since start={new Date(timestamp)} style={{paddingRight: 28, whiteSpace: "nowrap"}}/>
            </Stack>
        )
    }
    return (
        <AccordionItem value={props.accordionId} disabled={isMetadataEmpty}>
            <AccordionHeader expandIconPosition="end" icon={<LogItemIcon level={ props.item.level } />} >
                <Stack gap={8} horizontal horizontalFill horizontalAlign="space-between" verticalAlign="center" style={{minWidth: 0}}>
                    <Text style={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%"}}>{ props.item.message }</Text>
                    <Runtime since start={new Date(timestamp)} style={{whiteSpace: "nowrap"}}/>
                </Stack>
            </AccordionHeader>
            <AccordionPanel>
                <pre style={{marginLeft: 32, overflow: "auto"}}>
                    {
                        !isMetadataEmpty && JSON.stringify(metadata, null, 2)
                    }
                </pre>
            </AccordionPanel>
        </AccordionItem>
    );
}

function LogItemIcon(props: { level: LogEntry["level"] }) {
    function getIcon() {
        switch (props.level) {
            case "info":
                return <InfoRegular fontSize={20}/>
            case "debug":
                return <BugRegular fontSize={20} color="lightgreen"/>
            case "error":
                return <DismissCircleColor fontSize={20}/>
            case "warn":
                return <WarningColor fontSize={20}/>
        }
    }

    return (
        <Stack>
            {getIcon()}
        </Stack>
    );
}