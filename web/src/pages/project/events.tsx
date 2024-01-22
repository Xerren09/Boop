import { Stack, Text, Link } from "@fluentui/react";
import React from "react";
import TimeAgo from 'react-timeago';
import { DataTable } from "../../components/dataTable";

export class ProjectWebhookEvents extends React.Component<Props> {

    render(): React.ReactNode {
        return(
            <Stack>
                {
                    this.props.events.map((event, index) => (
                        <Stack
                            key={index}
                            verticalAlign="start"
                            horizontalAlign="start"
                            tokens={{childrenGap: 8}}
                            style={{ paddingTop: 12, paddingBottom: 12, paddingRight: 12 }}
                        >
                            <Stack horizontalAlign="start"> 
                                <Text variant="xLarge">{event.type}</Text>
                                <Text variant="small"><TimeAgo date={event.time}></TimeAgo></Text>
                            </Stack>
                            <DataTable rows={[
                                {
                                    label: "Received",
                                    content: <Text>{new Date(event.time).toLocaleString()}</Text>
                                },
                                {
                                    label: "Source",
                                    content: <Text><Link href={event.repository.url} target="_blank">{event.repository.url}</Link></Text>
                                },
                                {
                                    label: "Branch",
                                    content: <Text>{event.repository.branch || "---"}</Text>
                                },
                                {
                                    label: "Commit",
                                    content: (
                                        <Text>
                                            {
                                                (event.commit && event.commit.id.length !== 0) ?
                                                    (
                                                        <Link
                                                            href={event.commit.url}
                                                            target="_blank"
                                                        >
                                                            {event.commit.id}
                                                        </Link>
                                                    )
                                                        :
                                                    (
                                                        "---"
                                                    )
                                            }
                                        </Text>)
                                },
                                {
                                    label: "Sender",
                                    content: <Text><Link href={event.sender.url} target="_blank">{event.sender.name}</Link></Text>
                                }
                            ]}/>
                        </Stack>
                    ))
                }
            </Stack> 
        )
    }
}

interface Props {
    events: WebhookEvent[],
}


interface WebhookEvent {
    type: string;  // "ping"
    time: number,
    repository: {
        url: string;
        branch: string | null;
        name: string;
        owner: {
            name: string;
            url: string;
        },
    },
    commit: {
        id: string;
        url: string;
    },
    security: {
        hash: string | null;
        valid: boolean;
    },
    sender: {
        name: string;
        url: string;
    }
}