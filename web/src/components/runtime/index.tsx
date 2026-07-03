import { useEffect, useMemo, useRef, useState } from "react";
import { Text, Tooltip } from "@fluentui/react-components";
import Stack from "../stack";

const rtf = new Intl.RelativeTimeFormat("en-GB", {
    numeric: "auto",
    style: "long",
});

export default function Runtime(props: RuntimeProps) {
    const [value, setValue] = useState<string>("");
    const digitalRef = useRef<Array<number>>([0]);

    const startTimestamp = useMemo(() => {
        const date = new Date(props.start);
        return date.toLocaleString();
    }, [props.start])

    const endTimestamp = useMemo(() => {
        if (!props.end) {
            return null;
        }
        const date = new Date(props.end);
        return date.toLocaleString();
    }, [props.end])

    useEffect(() => {
        digitalRef.current = [0];
    }, [props.start, props.end]);


    useEffect(() => {
        if (props.start && props.end && !props.since) {
            // Static duration, no need for timeout
            return;
        }
        const duration = props.short ? 1000 : (calculateTimeoutDuration(props.end ?? props.start)*1000);
        const handle = setTimeout(() => { 
            setValue(formatter(props.start, props.end, props.short ? digitalRef.current : undefined, props.since));
        }, duration);
        return () => {
            clearTimeout(handle);
        };
    }, [props.start, props.end, props.since, props.short, value]);

    const content = ((props.start && props.end && !props.since) || (value == "")) ? formatter(props.start, props.end, props.short ? [] : undefined, props.since) : value;

    return (
        <Tooltip
            content={
                <Stack>
                    <Text>{props.end && "Start: "}{startTimestamp}</Text>
                    {
                        props.end && <Text>End: {endTimestamp}</Text>
                    }
                </Stack>
            }
            relationship="label"
        >
            <Text style={props.style}>
                {
                    content
                }
                {
                    props.children
                }
            </Text>
        </Tooltip>
    )
}

function getTimeUnit(delta: number) {
    if (delta < 60) 
        return "second"
    if (delta < 3600)
        return "minute"
    if (delta < 86400)
        return "hour"
    if (delta < 31536000)
        return "day"
    return "year"
}

function getDigitalTimeUnitsWithRef(delta: number, ref: Array<number>) {
    ref[0] = (delta % 60);
    if (delta >= 60)
        ref[1] = Math.floor(((delta % 86400) % 3600) / 60);
    if (delta >= 3600)
        ref[2] = Math.floor((delta % 86400) / 3600);
    if (delta >= 86400)
        ref[3] = Math.floor(delta / 86400);
}

function getTimeUnitValue(delta: number) {
    if (delta < 60) 
        return delta
    if (delta < 3600) 
        return Math.floor(delta / 60)
    if (delta < 86400)
        return Math.floor(delta / 3600)
    if (delta < 31536000) 
        return Math.floor(delta / 86400)
    return Math.floor(delta / 31536000)
}

function formatter(start: number | Date, end?: number | Date, digital?: Array<number>, relative?: boolean): string {
    /*
        start           - since start
            relative    - since start + ago
        start + end     - duration
            relative    - since end + ago
    */
    if (digital) {
        const secondsDelta = Math.floor(((end ?? Date.now()).valueOf() - start.valueOf()) / 1000);
        getDigitalTimeUnitsWithRef(secondsDelta, digital);
        let str = "";
        if (digital.length == 1) {
            str = `${digital[0]}s`;
        }
        else {
            for (let index = 0; index < digital.length; index++) {
                const element = digital[index];
                str = `${`${element}`.padStart(2, '0')}${index>0 ? ':' : ''}${str}`
            }
        }
        return str;
    }
    else {
        // Use INTL
        if (relative) {
            // <Start or End> ago
            const delta: number = Math.floor((Date.now() - (end ? end : start).valueOf()) / 1000);
            return rtf.format(getTimeUnitValue(delta) * -1, getTimeUnit(delta));
        }
        else {
            // Duration
            const delta: number = Math.floor(((end?.valueOf() ?? Date.now()) - start.valueOf()) / 1000);
            const unit = getTimeUnitValue(delta);
            return `${`${unit}`.padStart(2, '0')} ${getTimeUnit(delta)}${unit>1 && "s"}`;// df.format({ [`${getTimeUnit(delta)}s`]: getTimeUnitValue(delta) });
        }
    }
}

function calculateTimeoutDuration(start: number | Date) {
    const delta = Math.floor((Date.now() - (start).valueOf()) / 1000);
    if (delta < 60) 
        return delta
    if (delta < 3600) 
        return 60 - (delta % 60)
    if (delta < 86400)
        return 3600 - (delta % 3600)
    if (delta < 31536000) 
        return 86400 - (delta % 86400)
    return 31536000 - (delta % 31536000)
}

interface RuntimeProps extends React.PropsWithChildren {
    /**
     * The date or timestamp from which the elapsed time should be calculated from.
     */
    start: number | Date,
    /**
     * The date or timestamp for the end of time frame. If given the component will show the static duration between {@link start} and this time.
     */
    end?: number | Date,
    /**
     * If set the text be relative to {@link start}, or {@link end} if set.
     */
    since?: boolean,
    /**
     * If set the elapsed time will be displayed in digital format.
     */
    short?: boolean,
    style?: React.CSSProperties
}