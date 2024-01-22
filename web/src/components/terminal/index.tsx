import { Icon, Spinner, SpinnerSize, Stack, Text } from "@fluentui/react";
import React from "react";
import { Observable, Subscription } from "rxjs";
import './terminal.css';

export class Terminal extends React.Component<TerminalProps, TerminalState> {

    state: TerminalState = {
        autoScroll: true,
        collapsed: true
    }

    private terminalTextArea = React.createRef<HTMLTextAreaElement>();
    private terminalDiv = React.createRef<HTMLDivElement>();

    componentDidMount(): void {
        this.onCollapseClick(this.props.collapsed === undefined ? false : this.props.collapsed);
    }

    componentDidUpdate() {
        if (this.terminalTextArea.current) {
            if (this.state.autoScroll === true) {
                this.terminalTextArea.current.scrollTop = this.terminalTextArea.current.scrollHeight;
            }
        }
    }

    onScroll() {
        if (this.terminalTextArea.current) {
            const lineHeightPx = Math.abs(this.terminalTextArea.current.scrollHeight / this.props.source.length);
            const height = this.terminalTextArea.current.getBoundingClientRect().height;
            const delta = Math.abs(this.terminalTextArea.current.scrollHeight - (this.terminalTextArea.current.scrollTop + (height * 1.05)));
            const isAtBottom = this.terminalTextArea.current.scrollHeight <= this.terminalTextArea.current.scrollTop + (height * 1.05);
            if (this.state.autoScroll === false) {
                if (isAtBottom) {
                    this.setState({ autoScroll: true });
                }
            }
            else {
                if (delta > lineHeightPx*2) {
                    this.setState({ autoScroll: false });
                }
            }
        }
    }

    onCollapseClick(collapsed: boolean) {
        this.setState({
            collapsed: collapsed
        }, () => {
            if (this.terminalDiv.current) {
                if (this.state.collapsed === true) {
                    //@ts-expect-error
                    this.terminalDiv.current.style.maxHeight = null;
                }
                else {
                    this.terminalDiv.current.style.maxHeight = this.terminalDiv.current.scrollHeight + "px";
                } 
            }
        });
    }

    render(): React.ReactNode {
        return (
            <Stack
                tokens={{ childrenGap: 0 }}
                style={{ width: "100%", backgroundColor: "#2d3436" }}
            >
                <Stack
                    horizontal
                    horizontalAlign="space-between"
                    verticalAlign="center"
                    style={{ borderBottomColor: "black", borderBottomWidth: 1, borderBottomStyle: "solid", width: "100%" }}
                >
                    <Stack
                        horizontal
                        tokens={{ childrenGap: 8, padding: 8 }}
                    >
                        {
                            this.props.exitCode == null ?
                                <Spinner size={SpinnerSize.small}/>
                                :
                                (
                                    this.props.exitCode === 0 ?
                                        <Icon iconName="SkypeCircleCheck" style={{ color: "#7FBA00", width: 16, height: 16, userSelect: "none" }}></Icon>
                                        :
                                        <Icon iconName="StatusErrorFull" style={{ color: "#ff3333", width: 16, height: 16, userSelect: "none" }}></Icon>
                                )
                        }
                        <Text style={{ color: "#dddddd"}}>{this.props.title || "Terminal Output"}</Text>
                        {
                            (this.props.exitCode != null && this.props.exitCode !== 0) ?
                                <Text style={{ color: "#dddddd" }}> - Exit code: {this.props.exitCode}</Text>
                                :
                                undefined
                        }

                    </Stack>
                    <Icon
                        iconName={this.state.collapsed ? "ChevronRightMed" : "ChevronDownMed"}
                        style={{ color: "#dddddd", width: 16, height: 16, userSelect: "none", paddingRight: 12, paddingLeft: 12, paddingTop: 8, paddingBottom: 8 }}
                        onClick={() => {this.onCollapseClick(!this.state.collapsed)}}
                    ></Icon>
                </Stack>
                <div
                    className="content"
                    ref={this.terminalDiv}
                >
                    <Stack >
                        <textarea
                            onScroll={() => { this.onScroll() }}
                            ref={this.terminalTextArea}
                            name="terminalOutput"
                            value={this.props.source.join("")}
                            readOnly={true}
                            rows={this.props.maxHeightRows || 15}
                            className="terminal-content"
                        />
                        {
                            this.props.exitCode === null ? undefined : <Text style={{ color: "#dddddd", paddingLeft: "12px", marginBottom: "8px", paddingTop: "8px", width: "100%", textAlign: "start", borderTopColor: "black", borderTopWidth: 1, borderTopStyle: "solid", }}>Finished with exit code: {this.props.exitCode}</Text>
                        }
                    </Stack>
                </div>
            </Stack>
        );
    }
}

export type TerminalProps = {
    /**
     * The title of the terminal.
     * 
     * Defaults to `Terminal Output`
     */
    title?: string,
    /**
     * The source for the teminal's display. Can be either a string Observable or an array of strings.
     * 
     * Each entry should be started with `\n` if a new line is desired.
     */
    source: string[],
    /**
     * The terminal's exit code. Determines the icon shown before the title.
     * 
     * Values:
     * * `null` : Indeterminate loading spinner
     * * `0` : Success
     * * `non 0 value`: Error
     */
    exitCode?: number | null,
    /**
     * The maximum amount of rows displayed at once, before scrolling.
     */
    maxHeightRows?: number,
    /**
     * Sets if the terminal should start collapsed or not.
     */
    collapsed?: boolean,
    /**
     * Sets if the terminal should clear its content when receiving a `null` exitCode.
     */
    autoClear?: boolean,
}

interface TerminalState {
    autoScroll: boolean,
    collapsed: boolean
}