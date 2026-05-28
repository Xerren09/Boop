import { useMemo, useState } from "react";
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, SearchBox, type SearchBoxChangeEvent, type InputOnChangeData } from "@fluentui/react-components";
import ProjectListItem from "./item";
import Stack from "../../stack";
import type { ProjectEntry } from "../../../api/api";

const HeaderCells: HeaderCell[] = [
    {
        id: "name",
        label: "Name"
    },
    {
        id: "status",
        label: "Status",
        width: 40
    },
    {
        id: "lastCommitId",
        label: "Commit",
        width: 60
    },
    {
        id: "lastEventTime",
        label: "Last Event",
        width: 80
    },
];

type HeaderCell = {
    id: string,
    label: string,
    width?: React.CSSProperties["width"]
}

export default function ProjectList(props: Props) {
    const [filter, setFilter] = useState<string>("");

    const headerCells = useMemo(() => {
        return HeaderCells.map((column) => (
            <TableHeaderCell key={column.id} style={column.width ? {width: column.width} : undefined}>
                {column.label}
            </TableHeaderCell>
        ))
    }, [])

    const items = useMemo(() => {
        return props.projects.map(project => (
            <ProjectListItem
                key={project.name}
                name={project.name}
                type={project.type}
                disableActions={props.disableActions}
                hidden={ filter.length == 0 ? false : (project.name.includes(filter) == false) }
            />
        ));
       
    }, [props.projects, props.disableActions, filter])

    const onChange = (ev: SearchBoxChangeEvent, data: InputOnChangeData) => {
        setFilter(data.value)
    }

    return (
        <Stack gap={8} horizontalFill verticalFill>
            <Stack horizontal horizontalAlign="space-between">
                <SearchBox
                    placeholder="Search..."
                    onChange={onChange}
                    value={filter}
                    style={{
                        width: 250,
                        maxWidth: 250
                    }}
                />
            </Stack>
            <Table style={{width: "100%"}}>
                <TableHeader>
                    <TableRow>
                        {
                            ...headerCells
                        }
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        ...items
                    }
                </TableBody>
            </Table>    
        </Stack>
    )
}

type Props = {
    projects: ProjectEntry[],
    disableActions?: boolean
}