import { useMemo, useState } from "react";
import { Table, TableHeader, TableRow, TableHeaderCell, TableBody, SearchBox, type SearchBoxChangeEvent, type InputOnChangeData, TableCellLayout } from "@fluentui/react-components";
import ProjectListItem from "./item";
import Stack from "../../stack";
import type { ProjectEntry } from "../../../api/api";

const HeaderCells: HeaderCell[] = [
    {
        id: "name",
        label: "Name"
    },
    {
        id: "lastCommitId",
        label: "Commit",
        style: {
            width: 60,
            minWidth: 60
        }
    },
    {
        id: "lastEventTime",
        label: "Last Event",
        style: {
            width: 90,
            maxWidth: 140,
            minWidth: 90
        }
    },
];

type HeaderCell = {
    id: string,
    label: string,
    style?: React.CSSProperties,
}

export default function ProjectList(props: Props) {
    const [filter, setFilter] = useState<string>("");

    const headerCells = useMemo(() => {
        return HeaderCells.map((column) => (
            <TableHeaderCell key={column.id} style={{ whiteSpace: "nowrap", ...column.style }}>
                <TableCellLayout truncate>
                    {column.label}
                </TableCellLayout>
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