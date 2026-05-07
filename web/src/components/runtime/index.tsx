import { useEffect, useMemo, useState } from "react";
import { Text, Tooltip } from "@fluentui/react-components";

function calcInitialValue(start: number | Date, end?: number | Date) {
    const startMs = typeof (start) === "number" ? start : start.getTime();
    const endMs = typeof (end) === "number" ? end : end?.getTime();

    const ret = Math.floor((endMs == undefined ? (Date.now() - startMs) : (endMs - startMs)) / 1000);
    return ret;
}

function getTimeString(counter: number, short?: boolean) {
    const minute = Math.floor(counter / 60);
    const hour = Math.floor(counter / 3600);
    const day = Math.floor(counter / 86400);
    const year = Math.floor(counter / 31536000);

    if (counter < 60) 
        return short ? `${counter}s` : `${counter} seconds`
    if ((counter >= 60) && (counter < 3600)) 
        return short ? `${String(minute).padStart(2, "0")}:${String(Math.floor(counter % 60)).padStart(2, "0")}` : `${minute} minute${minute > 1 ? "s" : ""}`
    if ((counter > 3600) && (counter < 86400))
        return short ? `${String(hour).padStart(2, "0")}:${String(Math.floor((counter % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(counter % 60)).padStart(2, "0")}` : `${hour} hour${hour > 1 ? "s" : ""}`
    if ((counter > 86400) && ((counter < 31536000) || short == true)) 
        return short ? `${String(day).padStart(2, "0")}:${String(Math.floor((counter % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor(((counter % 86400) % 3600) / 60)).padStart(2, "0")}:${String(Math.floor((((counter % 86400) % 3600) % 60) % 60)).padStart(2, "0")}` : `${day} day${day > 1 ? "s" : ""}`
    if (counter > 31536000) 
        return `${year} year${year > 1 ? "s" : ""}`
    return "";
}

export default function Runtime(props: Props) {
    const [counter, setCounter] = useState<number>(() => calcInitialValue(props.start, props.end));
    
    const timestamp = useMemo(() => {
        const date = new Date(props.start);
        return date.toLocaleString();
    }, [props.start])

    const timestring = useMemo(() => {
        return getTimeString(counter, props.short);
    }, [counter, props.short])

    useEffect(() => {
        if (props.end === undefined) {
            const interval = setInterval(() => {
                setCounter((prev) => prev + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [props.end])

    useEffect(() => {
        //eslint-disable-next-line react-hooks/set-state-in-effect
        setCounter(() => calcInitialValue(props.start, props.end));
    }, [props.start, props.end])

    return (
        <Tooltip content={ timestamp } relationship="label">
            <Text style={props.style}>
                {
                    timestring
                }
                {
                    (props.end === undefined) && props.since == true ? " ago" : null
                }
                {
                    props.children
                }
            </Text>
        </Tooltip>
    )
}

interface Props extends React.PropsWithChildren {
    /**
     * The date or timestamp from which the elapsed time should be calculated from.
     */
    start: number | Date,
    /**
     * The date or timestamp for the end of time frame. If given the component will show the static duration between {@link start} and this time.
     */
    end?: number | Date,
    /**
     * If set the text will read "<time> ago", instead of just the time. Ignored when {@link end} is set.
     */
    since?: boolean,
    short?: boolean,
    style?: React.CSSProperties
}