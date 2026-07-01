import type { PropsWithChildren } from "react";
import { ProjectTab } from "./tabs.enum";
import { Link } from "react-router";

export default function ProjectTabLink(props: TabLinkProps) {
    const search = new URLSearchParams(props.params).toString();
    return (
        <Link
            to={{ hash: `#${ProjectTab[props.target]}`, search: search }}
            onClick={() => {
                // Force the hashchange event to fire.
                window.location.hash = `#${ProjectTab[props.target]}`;
            }}
        >
            {props.children}
        </Link>
    );
}

export interface TabLinkProps extends PropsWithChildren {
    target: ProjectTab,
    params?: { [key: string]: string }
}