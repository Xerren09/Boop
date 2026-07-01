import { useMemo } from "react";
import Section from "../section";

interface StatusDescriptionProps<T> {
    title: string;
    icon?: React.ReactNode,
    selectedItem: T,
    children: React.ReactElement<DescriptionItemProps<T>, typeof StatusDescriptionItem<T>>[]
}

export function StatusDescription<T>(props: StatusDescriptionProps<T>) {
    const selectedItem = useMemo(() => {
        const item = props.children.find(el => el.props.value === props.selectedItem);
        return item;
    }, [props.selectedItem, props.children]);

    return (
        <Section
            title={props.title}
            icon={props.icon}
        >
            {
                selectedItem
            }
        </Section>
    );
}

interface DescriptionItemProps<T> extends React.PropsWithChildren {
    value: T
}

export function StatusDescriptionItem<T>(props: DescriptionItemProps<T>) {
    return (
        <div>
            {props.children}
        </div>
    )
}

