import { Text } from "@fluentui/react-components"

export default function TerminalFooter(props: TerminalFooterProps) {
    return (
        <Text
            style={{
                color: "#dddddd",
                paddingLeft: "12px",
                marginBottom: "8px",
                paddingTop: "8px",
                width: "100%",
                textAlign: "start",
                borderTopColor: "black",
                borderTopWidth: 1,
                borderTopStyle: "solid",
            }}
        >
            {
                props.dud && "Process never started."
            }
            {
                !props.dud && (props.exitCode === null ? "Running..." : `Exited with code: ${props.exitCode}`)
            }
            {
                props.killed ? " (killed)" : null
            }
        </Text>
    )
}

interface TerminalFooterProps {
    exitCode: number | null,
    dud?: boolean,
    killed?: boolean
}