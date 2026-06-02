import type { PropsWithChildren } from "react";
import { Tabs } from "./tabs";
import { Link } from "react-router";

export default function ProjectTabLink(props: TabLinkProps) {
    const search = new URLSearchParams(props.params).toString();
    return (
        <Link
            to={{ hash: `#${Tabs[props.target]}`, search: search }}
            onClick={() => {
                // Force the hashchange event to fire.
                window.location.hash = `#${Tabs[props.target]}`;
            }}
        >
            {props.children}
        </Link>
    );
}

export interface TabLinkProps extends PropsWithChildren {
    target: Tabs,
    params?: { [key: string]: string }
}