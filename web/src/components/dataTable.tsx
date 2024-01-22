import { Stack, Text } from "@fluentui/react";
import React from "react";

const tdStyle: React.CSSProperties = {
    textAlign: "start",
    padding: 0
};

const tdSeparatorStyle: React.CSSProperties = {
    ...tdStyle,
    paddingLeft: 8,
    paddingRight: 8
};

export class DataTable extends React.Component<DataTableProps> {

    render(): React.ReactNode {
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
                        borderCollapse: "collapse"
                    }}
                >
                    <tbody>
                        {
                            this.props.rows.map((row, index) => (
                                <tr key={index}>
                                    <td style={tdStyle}><Text>{ row.label }</Text></td>
                                    <td style={tdSeparatorStyle}><Text>:</Text></td>
                                    <td style={tdStyle}> { row.content } </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </Stack>
        )
    }
}

interface DataTableProps {
    rows: DataTableRow[]
}

export interface DataTableRow {
    label: string;
    content: React.ReactNode
}