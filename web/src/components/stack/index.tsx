import React from "react";
import styles from "./stack.module.css";

function computedStyle(props: StackProps) : React.CSSProperties {
    const direction = props.horizontal == true ? "row" : "column";

    const ret: React.CSSProperties = {
        flexDirection: direction,
        gap: `${props.gap == undefined ? "0" : props.gap}px`,
        alignItems: direction == "column" ? `${props.horizontalAlign ?? "normal"}` : `${props.verticalAlign ?? "normal"}`,
        justifyContent: direction == "column" ? `${props.verticalAlign ?? "normal"}` : `${props.horizontalAlign ?? "normal"}`,
        height: props.verticalFill == true ? `100%` : "auto",
        width: props.horizontalFill == true ? `100%` : "auto"
    }

    return ret;
}

export default function Stack(props: StackProps) {
    return (
        <div id={ props.id } className={props.className ? `${styles.stack} ${props.className}` : styles.stack} style={{...computedStyle(props), ...props.style}}>
            {props.children}
        </div>
    );
}

interface StackProps extends React.PropsWithChildren {
    horizontal?: boolean,
    gap?: number,
    horizontalAlign?: React.CSSProperties["alignItems"],
    verticalAlign?: React.CSSProperties["justifyContent"],
    verticalFill?: boolean,
    horizontalFill?: boolean,
    style?: React.CSSProperties,
    id?: string,
    className?: string
}