import { Stack, Text } from "@fluentui/react";
import React from "react";

export class SectionComponent extends React.Component<SectionComponentProps> {
    render(): React.ReactNode {
        return (
            <Stack
                horizontalAlign="start"
                style={{
                    width: "100%",
                    //marginTop: 24,
                    //backgroundColor: "white",
                    //padding: 18,
                    //boxShadow: "5px 5px 10px 5px #00000023"
                }}
            >
                <Stack horizontal horizontalAlign="space-between" style={{ width: "100%", marginBottom: 12 }}>
                    <Stack horizontalAlign="start">
                        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ childrenGap: 8 }}>
                            {
                                this.props.title ? <Text variant="xLarge">{ this.props.title }</Text> : undefined
                            }
                            {
                                this.props.titleExtras 
                            }
                        </Stack>
                        {
                            typeof this.props.subTitle === "string" ? <Text variant="small">{ this.props.subTitle }</Text> : this.props.subTitle
                        }
                    </Stack>
                    {
                        this.props.right
                    }
                </Stack>
                {
                    this.props.children
                }
            </Stack>
        );
    }
}

interface SectionComponentProps extends React.PropsWithChildren {
    title?: string,
    titleExtras?: React.ReactNode,
    subTitle?: React.ReactNode,
    right?: React.ReactNode,
}