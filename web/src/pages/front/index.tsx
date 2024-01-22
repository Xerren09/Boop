import { DetailsList, DetailsListLayoutMode, IColumn, Icon, SelectionMode, Stack, Text, Link } from "@fluentui/react";
import React from "react";
import TimeAgo from 'react-timeago';
import { DataTable } from "../../components/dataTable";
import { SectionComponent } from "../../components/section";
import { Link as RouterLink } from "react-router-dom";
import { getApiString } from "../../util";

export class FrontPageComponent extends React.Component<{}, ProjectListState> {

    state: ProjectListState = {
        items: [],
        status: {
            uptime: 0,
            projects: 0,
            system: "unknown",
            nodeVer: "unknown"
        },
        columns: [
            {
                key: "deployed",
                name: "Deployed",
                minWidth: 25,
                maxWidth: 75,
                fieldName: "deployed",
                onRender: (item: ProjectItem) => (
                    <Stack horizontalAlign="start" verticalAlign="center" style={{height: "100%"}}>
                        {
                            item.deployed === true ?
                                <Icon iconName="SkypeCircleCheck" style={{ color: "#7FBA00", fontSize: 16, userSelect: "none" }}></Icon>
                                :
                                <Icon iconName="StatusErrorFull" style={{ color: "#ff3333", fontSize: 16, userSelect: "none" }}></Icon>
                        }
                    </Stack>
                ),
            },
            {
                key: "name",
                name: "Name",
                isRowHeader: true,
                minWidth: 90,
                maxWidth: 350,
                fieldName: "name",
                onRender: (item: ProjectItem) => (
                    <RouterLink to={ `/${item.name}` } style={{textDecoration: "none" }}><Link>{ item.name }</Link></RouterLink>
                )
            },
            {
                key: "type",
                name: "Type",
                minWidth: 50,
                fieldName: "type"
            },
            {
                key: "lastEvent",
                name: "Last Event",
                minWidth: 90,
                fieldName: "lastEvent",
                onRender: (item: ProjectItem) => (
                    <TimeAgo date={item.lastEvent}></TimeAgo>
                )
            }
        ]
    }

    componentDidMount(): void {
        window.document.title = "Boop - Dashboard";
        fetch(`${getApiString()}/projects`).then(res => {
            if (res.ok) {
                res.json().then((list: any[]) => {
                    this.setState({
                        items: list.map(el => ({
                            name: el.name,
                            lastEvent: el.lastEvent,
                            type: el.type,
                            deployed: el.deployed
                        }))
                    });
                });
            }
        });
        fetch(`${getApiString()}/status`).then(res => {
            if (res.ok) {
                res.json().then((status: any) => {
                    this.setState({
                        status: {
                            ...status
                        }
                    });
                });
            }
        });
    }

    render(): React.ReactNode {
        return (
            <Stack style={{width: "100%"}} tokens={{childrenGap: 24}}>
                <SectionComponent title="System">
                    <Stack style={{width: "100%", marginBottom: 12}}>
                        <DataTable
                            rows={[
                                {
                                    label: "OS",
                                    content: <Text>{ this.state.status.system }</Text>
                                },
                                {
                                    label: "Node version",
                                    content: <Text>{ this.state.status.nodeVer }</Text>
                                },
                                {
                                    label: "Started",
                                    content: <Text><TimeAgo date={Date.now() - this.state.status.uptime}></TimeAgo></Text>
                                },
                                {
                                    label: "Projects",
                                    content: <Text>{ this.state.status.projects }</Text>
                                }
                            ]}
                        />
                    </Stack>
                </SectionComponent>
                <SectionComponent title="Projects">
                    <Stack style={{width: "100%", marginBottom: 12}}>
                        <DetailsList
                            items={this.state.items}
                            columns={this.state.columns}
                            selectionMode={SelectionMode.none}
                            setKey="none"
                            layoutMode={DetailsListLayoutMode.justified}
                            isHeaderVisible={true}
                        />
                    </Stack>
                </SectionComponent>
            </Stack>
        );
    }
}

interface ProjectListState {
    items: ProjectItem[];
    status: {
        projects: number,
        uptime: number,
        nodeVer: string,
        system: string
    },
    columns: IColumn[]
}

interface ProjectItem {
    name: string;
    lastEvent: number;
    type: string;
    deployed: boolean;
}