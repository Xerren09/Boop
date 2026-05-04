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
        label: "Status"
    },
    {
        id: "lastCommitId",
        label: "Commit"
    },
    {
        id: "lastEventTime",
        label: "Last Event"
    },
];

type HeaderCell = {
    id: string,
    label: string
}

export default function ProjectList(props: Props) {
    const [filter, setFilter] = useState<string>("");

    const headerCells = useMemo(() => {
        return HeaderCells.map((column) => (
            <TableHeaderCell key={column.id}>
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
        <Stack gap={8}>
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
            <Table>
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