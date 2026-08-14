import { useEffect, useRef, useState } from "react";
import './terminal.css';
import Stack from "../../stack";
import TerminalHeader from "./header";
import { RemoteProcess } from "../../../api/api";
import TerminalFooter from "./footer";
import TerminalScreen from "./content";
import { Text } from "@fluentui/react-components";
import StatusIcon from "../../statusIcon";

export default function Terminal(props: Props) {
    const [collapsed, setCollapsed] = useState<boolean>(props.startCollapsed ?? true);
    const container = useRef<HTMLDivElement>(null);

    const [code, setCode] = useState<number | null>(null);

    function onCollapseClick(_collapsed: boolean) {
        setCollapsed(_collapsed);
    }

    /**
     * Effect for lazy loading content when using props.stream. By default terminals start collapsed, so we don't need the content right away.
     * When the terminal is expanded, request the content to be loaded.
     * 
     * NOTE: this only applies when props.stream is used, otherwise the content is pulled from props.process.
     */
    useEffect(() => {
        if (props.process) {
            return;
        }
        if (props.content === null && collapsed === false) {
            if (props.onContentRequested) {
                props.onContentRequested();
            }
        }
    }, [props.process, props.content, props.onContentRequested, collapsed]);

    /**
     * Effect for handling a RemoteProcess passed via props.process. This will hook the process up to the terminal's state.
     */
    useEffect(() => {
        if (props.process == undefined) {
            return;
        }
        let shouldClear = true;
        const sub = props.process.output.subscribe({
            next() {
                if (shouldClear) {
                    shouldClear = false;
                    setCode(props.process.exitCode);
                }
            },
            complete() {
                setCode(props.process.exitCode);
            },
        });
        return () => {
            sub.unsubscribe();
        }
    }, [props.process]);

    /**
     * Effect for handling the collapse / expansion of the terminal.
     */
    useEffect(() => {
        if (container.current) {
            //@ts-expect-error Set to null is valid
            container.current.style.maxHeight = collapsed ? null : `${container.current.scrollHeight}px`;
        }
    }, [collapsed, container]);

    const exitCode = props.process ? code : props.exitCode;
    const isDeadProcess = props.process ? props.process.dud : (props.exitCode === null && props.startTime == 0);
    const killed = props.process ? props.process.killed : props.killed;

    return (
        <Stack
            style={{ width: "100%", backgroundColor: `#242424`, borderRadius: "8px" }}
        >
            <TerminalHeader
                title={props.title}
                collapsed={collapsed}
                onCollapse={onCollapseClick}
                exitCode={exitCode}
                startTime={props.process ? props.process.startTime : props.startTime}
                exitTime={props.process ? props.process.exitTime : props.exitTime}
                dud={isDeadProcess}
                killed={killed}
            />
            <div
                className="content"
                ref={container}
            >
                <Stack >
                    {
                        isDeadProcess &&
                        <Stack horizontalFill verticalFill style={{minHeight: 150}} horizontalAlign="center" verticalAlign="center" gap={4}>
                                <StatusIcon status="warning"/>
                                <Text>No content; this process never started.</Text>
                        </Stack>
                    }
                    {
                        isDeadProcess == false && <TerminalScreen value={ props.content } stream={ props.process?.output }/>
                    }
                    <TerminalFooter exitCode={exitCode} dud={isDeadProcess} killed={killed} />
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
    startCollapsed?: boolean,
    /**
     * Called when the terminal is expanded and its static {@link StaticProps.content} property is `null`.
     * 
     * The steam property's value should then be updated with the actual terminal output.
     */
    onContentRequested?: () => void,
}

type StaticProps = {
    /**
     * The source for the teminal's display.
     * 
     * Each entry should be started with `\n` if a new line is desired.
     */
    content: string | null,
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
    killed?: boolean,
    process?: never
}

type RemoteProcessProps = {
    content?: never,
    exitCode?: never,
    startTime?: never,
    exitTime?: never,
    /**
     * A live {@link RemoteProcess} object. When this is used, static value props such as `stream` are ignored and not used.
     */
    process: RemoteProcess
}

type Props = CommonProps & (RemoteProcessProps | StaticProps)