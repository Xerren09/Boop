import { Text, Title3 } from '@fluentui/react-components';
import React from "react";
import Stack from './stack';

export default function Section(props: SectionComponentProps) {
    return (
        <Stack
            horizontalAlign="start"
            style={{
                width: "100%",
                padding: 18,
                boxShadow: "5px 5px 10px 5px #00000023",
                borderRadius: 6,
                ...props.style
            }}
        >
            <Stack horizontal horizontalAlign="space-between" verticalAlign='baseline' style={{ width: "100%", marginBottom: 12 }}>
                <Stack horizontalAlign="start">
                    <Stack horizontal horizontalAlign="center" verticalAlign="end" gap={8}>
                        <Stack horizontal horizontalAlign="center" verticalAlign="center" gap={8}>
                            {
                                props.icon
                            }
                            {
                                props.title ? <Title3>{ props.title }</Title3> : undefined
                            }
                        </Stack>
                        {
                            props.titleExtras 
                        }
                    </Stack>
                    {
                        typeof props.subTitle === "string" ? <Text size={200}>{ props.subTitle }</Text> : props.subTitle
                    }
                </Stack>
                {
                    props.right
                }
            </Stack>
            {
                props.children
            }
        </Stack>
    );
}

interface SectionComponentProps extends React.PropsWithChildren {
    title?: string,
    icon?: React.ReactNode,
    titleExtras?: React.ReactNode,
    subTitle?: React.ReactNode,
    right?: React.ReactNode,
    style?: React.CSSProperties,
}