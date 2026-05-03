import { Text } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import './terminal.css';
import Stack from "../stack";
import TerminalHeader from "./header";
import { RemoteProcess } from "../../api/api";

export default function Terminal(props: Props) {
    const [autoScroll, enableAutoscroll] = useState<boolean>(true);
    const [collapsed, setCollapsed] = useState<boolean>(props.startCollapsed ?? true);

    const lineCount = useRef<number>(0);

    const [code, setCode] = useState<number | null>(null);
    const [startTime, setStartAt] = useState<number>(0);
    const [exitTime, setExitedAt] = useState<number>(0);

    const textArea = useRef<HTMLTextAreaElement>(null);
    const container = useRef<HTMLDivElement>(null);

    function onNewLine(line: string, clear?: boolean) {
        if (textArea.current == null) {
            return;
        }
        if (clear) {
            lineCount.current = 0;
            textArea.current.value = "";
        }
        if (lineCount.current > RemoteProcess.MAX_OUTPUT_HISTORY)
        {
            // HACK: set the textArea text directly because its might be large and we want to avoid duplicating it in both the state + htmlelement
            textArea.current.value = textArea.current.value.substring(line.length) + line;
        }
        else {
            lineCount.current++;
            textArea.current.value += line;
        }
    }

    function onCodeChange(exitCode: number | null) {
        if (exitCode === null) {
            textArea.current!.value = "";
            lineCount.current = 0;
        }
        setCode(exitCode);
    }

    function onScroll() {
        if (textArea.current) {
            const lineHeightPx = Math.abs(textArea.current.scrollHeight / textArea.current.value.length);
            const height = textArea.current.getBoundingClientRect().height;
            const delta = Math.abs(textArea.current.scrollHeight - (textArea.current.scrollTop + (height * 1.05)));
            const isAtBottom = textArea.current.scrollHeight <= textArea.current.scrollTop + (height * 1.05);
            if (autoScroll === false) {
                if (isAtBottom) {
                    enableAutoscroll(true);
                }
            }
            else {
                if (delta > (lineHeightPx * 2)) {
                    enableAutoscroll(false);
                }
            }
        }
    }

    function onCollapseClick(_collapsed: boolean) {
        setCollapsed(_collapsed);
    }

    useEffect(() => {
        if (props.process == undefined) {
            return;
        }
        let shouldClear = true;
        const sub = props.process.output.subscribe({
            next(value) {
                if (shouldClear) {
                    shouldClear = false;
                    setStartAt(props.process.startTime!);
                    onCodeChange(props.process.exitCode);
                    setExitedAt(props.process.exitTime!);
                    onNewLine(value, true);
                }
                else {
                    onNewLine(value);
                }
            },
            complete() {
                if (props.process.dud) {
                    // Never started
                    onCodeChange(props.process.exitCode);
                }
                else {
                    // Normal process
                    onCodeChange(props.process.exitCode);
                    setExitedAt(props.process.exitTime!);
                }
            },
        });
        return () => {
            sub.unsubscribe();
        }
    }, [props.process]);

    useEffect(() => {
        if (container.current) {
            //@ts-expect-error Set to null is valid
            container.current.style.maxHeight = collapsed ? null : `${container.current.scrollHeight}px`;
        }
    }, [collapsed, container]);

    useEffect(() => {
        if (textArea.current) {
            if (autoScroll === true) {
                textArea.current.scrollTop = textArea.current.scrollHeight;
            }
        }
    }, [autoScroll, textArea]);

    return (
        <Stack
            style={{ width: "100%", backgroundColor: "#2d3436", borderRadius: "8px" }}
        >
            <TerminalHeader
                title={props.title}
                collapsed={ collapsed }
                onCollapse={ onCollapseClick }
                exitCode={props.process ? code : props.exitCode}
                startTime={props.process ? (startTime == 0 ? undefined : startTime) : props.startTime}
                exitTime={props.process ? (exitTime == 0 ? undefined : exitTime) : props.exitTime}
            />
            <div
                className="content"
                ref={container}
            >
                <Stack >
                    <textarea
                        onScroll={ onScroll }
                        ref={textArea}
                        name="terminalOutput"
                        value={props.process ? props.stream : ""}
                        readOnly={true}
                        rows={props.maxHeightRows ?? 15}
                        className="terminal-content"
                        placeholder="Waiting for process output..."
                    />
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
                            code === null ? "Running..." : `Exited with code: ${code}`
                        }
                    </Text>
                </Stack>
            </div>
        </Stack>
    );
    
}

type CommonProps = {
    /**
     * The title of the terminal.
     * 
     * Defaults to `Terminal Output`
     */
    title?: string,
    /**
     * The maximum amount of rows displayed at once, before scrolling.
     */
    maxHeightRows?: number,
    /**
     * Sets if the terminal should start collapsed or not.
     */
    startCollapsed?: boolean
}

type StaticProps = {
    /**
     * The source for the teminal's display. Can be either a string Observable or an array of strings.
     * 
     * Each entry should be started with `\n` if a new line is desired.
     */
    stream: string,
    /**
     * The terminal's exit code. Determines the icon shown before the title.
     * 
     * Values:
     * * `null` : Indeterminate loading spinner
     * * `0` : Success
     * * `non 0 value`: Error
     */
    exitCode: number | null,
    startTime: number | Date,
    exitTime: number | Date,
    process?: never
}

type RemoteProcessProps = {
    stream?: never,
    exitCode?: never,
    startTime?: never,
    exitTime?: never,
    /**
     * A live {@link RemoteProcess} object. When this is used, static value props such as `stream` are ignored and not used.
     */
    process: RemoteProcess
}

type Props = CommonProps & (RemoteProcessProps | StaticProps)