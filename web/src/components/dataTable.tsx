import { Text } from "@fluentui/react-components";
import React from "react";
import Stack from "./stack";

const tableHeadColStyle: React.CSSProperties = {
    textAlign: "start",
    padding: 0
};

const tableContentColStyle: React.CSSProperties = {
    textAlign: "start",
    padding: 0,
    width: "100%"
};

const tableSeparatorStyle: React.CSSProperties = {
    ...tableHeadColStyle,
    paddingLeft: 8,
    paddingRight: 8
};

export default function DataTable(props:DataTableProps) {
    return (
        <Stack
            horizontalAlign="start"
            style={{
                width: "100%",
                paddingTop: 12,
                paddingBottom: 12,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "rgb(204, 204, 204)",
                borderLeft: "none",
                borderRight: "none"
            }}
        >
            <table
                style={{
                    borderSpacing: `${props.gap ?? 0}px`,
                    display: "table"
                }}
            >
                <tbody>
                    {
                        props.rows.map((row, index) => (
                            <DataTableRow key={`${row.label}-${index}`} label={row.label} separator={ props.separator }>{ row.content }</DataTableRow>
                        ))
                    }
                    {
                        props.children
                    }
                </tbody>
            </table>
        </Stack>
    )
}

export function DataTableRow(props: DataTableRowProps) {
    return (
        <tr>
            <td style={tableHeadColStyle}><Text wrap={false}>{ props.label }</Text></td>
            <td style={tableSeparatorStyle}><Text>{ props.separator ?? ":" }</Text></td>
            <td style={tableContentColStyle}> { props.children } </td>
        </tr>
    )
}
interface DataTableProps extends React.PropsWithChildren {
    rows: DataTableRow[],
    gap?: number,
    separator?: string
}

interface DataTableRowProps extends React.PropsWithChildren {
    label: string,
    separator?: string
}

export interface DataTableRow {
    label: string;
    content: React.ReactNode
}