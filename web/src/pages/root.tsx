import { IStackStyles, IStackTokens, Link, Stack, Text } from "@fluentui/react";
import React from "react";
import { Outlet } from "react-router-dom";

const stackTokens: IStackTokens = { childrenGap: 15 };
const stackStyles: Partial<IStackStyles> = {
    root: {
        paddingLeft: "25vw",
        paddingRight: "25vw",
        paddingTop: "44px",
        margin: '0 auto',
        textAlign: 'center',
        color: '#605e5c',
        height: "100vh",
        scrollbarGutter: "stable",
        overflow: "auto"
    },
};

export class BoopRoot extends React.Component {

    render(): React.ReactNode {
        return (
            <div>
                
                <Stack horizontalAlign="center" verticalAlign="start" verticalFill styles={stackStyles} tokens={stackTokens}>
                    <Stack tokens={{ childrenGap: 12 }} style={{ width: "100%", marginBottom: 56 }}>
                        <Stack
                            horizontalAlign="start"
                        >
                            <Text
                                variant='superLarge'
                                style={{ fontWeight: 700, color: "#00abec" }}
                            >
                                Boop!
                            </Text>
                            <Text>
                                <Link
                                    href="https://github.com/Xerren09/Boop"
                                    target="_blank"
                                    style={{ textDecoration: "none" }}
                                >
                                    A lightweight CI/CD server for GitHub repositories
                                </Link>
                            </Text>
                        </Stack>
                        <Outlet></Outlet>
                    </Stack>
                </Stack>
            </div>
        )
    }
}