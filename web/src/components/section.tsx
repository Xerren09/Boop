import { Subtitle2, Title3, tokens } from '@fluentui/react-components';
import React from "react";
import Stack from './stack';

export default function Section(props: SectionComponentProps) {

    const shouldRenderHeaderDiv = props.icon || props.title || props.titleExtras || props.right || props.subTitle;

    return (
        <Stack
            horizontalAlign="start"
            horizontalFill
            style={{
                width: "100%",
                padding: 18,
                boxShadow: `5px 5px 10px 5px #00000023, inset 1px 1px ${tokens.colorSubtleBackgroundSelected}`,
                borderRadius: 6,
                ...props.style
            }}
        >
            <Stack horizontalFill horizontalAlign="space-between" verticalAlign='start' gap={8} style={{ marginBottom: shouldRenderHeaderDiv ? (props.headerMargin ?? 20) : 0 }}>
                <Stack horizontal horizontalAlign="start" horizontalFill gap={4}>
                    <Stack horizontal horizontalFill horizontalAlign="center" verticalAlign="end" gap={8}>
                        <Stack horizontal horizontalFill verticalAlign="center" gap={8}>
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
                        props.right
                    }
                </Stack>
                {
                    typeof props.subTitle === "string" ? <Subtitle2>{ props.subTitle }</Subtitle2> : props.subTitle
                }
            </Stack>
            {
                props.children
            }
        </Stack>
    );
}

interface SectionComponentProps extends React.PropsWithChildren {
    /**
     * The main title text of the section.
     */
    title?: string,
    /**
     * Icon to be displayed before the title.
     */
    icon?: React.ReactNode,
    /**
     * Additional content displayed after the title.
     */
    titleExtras?: React.ReactNode,
    /**
     * Subtitle displayed under the title row. If `string`, it will be displayed as a {@link Subtitle2}.
     */
    subTitle?: React.ReactNode | string,
    /**
     * Content to be displayed to the right border of the section's title.
     */
    right?: React.ReactNode,
    style?: React.CSSProperties,
    headerMargin?: number
}