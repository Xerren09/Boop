import { useContext, useEffect, useState } from "react";
import Section from "../../components/section";
import { ProjectProvider } from "../../api/api";
import Stack from "../../components/stack";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Text } from "@fluentui/react-components";
import { BugRegular, DismissCircleColor, InfoRegular, WarningColor } from "@fluentui/react-icons";
import Runtime from "../../components/runtime";

interface LogEntry {
    level: "info" | "warn" | "error" | "debug",
    message: string,
    metadata: {
        timestamp: string
    }
}

export default function ProjectLogTab() {
    const project = useContext(ProjectProvider);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    useEffect(() => { 
        if (project) {
            project.getProjectLog().then((str) => {
                const rawEntries = str!.split(/\r?\n/);
                const entries: LogEntry[] = [];
                for (const element of rawEntries) {
                    try {
                        if (!element || element === "") {
                            continue;
                        }
                        const obj = JSON.parse(element);
                        entries.push(obj);
                    }
                    catch {
                        console.error("Log line is not a valid JSON:", element);
                    }
                }
                setLogEntries(entries);
            })
        }
    }, [project]);

    return (
        <Section
            title="Project Log"
            style={{
                marginBottom: 22,
                height: "100%"
            }}
        >
            <Stack verticalFill horizontalFill style={{maxHeight: "50vh", overflow: "auto"}}>
                <Accordion collapsible multiple>
                    {
                        logEntries.map((entry, index) => 
                            <LogItem item={entry} accordionId={index}/>
                        )
                    }
                </Accordion>
            </Stack>
        </Section>
    )
}

function LogItem(props: { item: LogEntry, accordionId: number }) {
    const isMetadataEmpty = Object.keys(props.item.metadata).length == 1;
    const { timestamp, ...metadata } = props.item.metadata;
    if (isMetadataEmpty) {
        return (
            <Stack horizontal horizontalFill horizontalAlign="space-between" verticalAlign="center" style={{ paddingLeft: 10, paddingRight: 10, minHeight: 44}}>
                <Stack gap={8} horizontal verticalAlign="center">
                    <LogItemIcon level={props.item.level} />
                    <Text>{ props.item.message }</Text>
                </Stack>
                <Runtime since start={new Date(timestamp)} style={{paddingRight: 28}}/>
            </Stack>
        )
    }
    return (
        <AccordionItem value={props.accordionId} disabled={isMetadataEmpty}>
            <AccordionHeader expandIconPosition="end" icon={<LogItemIcon level={ props.item.level } />} style={{color: "white", fill: "white"}}>
                <Stack horizontal horizontalFill horizontalAlign="space-between">
                    <Text>{ props.item.message }</Text>
                    <Runtime since start={new Date(timestamp)}/>
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