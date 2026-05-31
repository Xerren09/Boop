import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Text } from "@fluentui/react-components";
import type { LogEntry } from "../../api/api";
import { BugRegular, DismissCircleColor, InfoRegular, WarningColor } from "@fluentui/react-icons";
import Stack from "../stack";
import Runtime from "../runtime";

export default function LogList(props: { log: LogEntry[]}) {
    return (
        <Accordion collapsible multiple>
            {
                props.log.map((entry, index) => 
                    <LogItem key={index} item={entry} accordionId={`${index}`}/>
                )
            }
        </Accordion>
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
            <AccordionHeader expandIconPosition="end" icon={<LogItemIcon level={ props.item.level } />} style={{color: "white", fill: "white"}}>
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