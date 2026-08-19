import type { PropsWithChildren } from "react";
import { ProjectTab } from "./projectTabs.enum";
import { Link } from "@fluentui/react-components";
import { Link as NavLink } from "react-router";

export default function ProjectTabLink(props: TabLinkProps) {
    const search = new URLSearchParams(props.params).toString();
    return (
        <NavLink
            to={{ hash: `#${ProjectTab[props.target]}`, search: search }}
            onClick={() => {
                // Force the hashchange event to fire.
                window.location.hash = `#${ProjectTab[props.target]}`;
            }}
            style={{
                textDecoration: "none"
            }}
        >
            <Link>{props.children}</Link>
        </NavLink>
    );
}

export interface TabLinkProps extends PropsWithChildren {
    target: ProjectTab,
    params?: { [key: string]: string }
}