import { Dropdown, DropdownMenuItemType, IDropdownOption } from "@fluentui/react";
import React from "react";

export class BuildLogSelect extends React.Component<BuildLogSelectProps, { items: IDropdownOption<any>[], selection: string | number }> {

    state: { items: IDropdownOption<any>[], selection: string | number } = {
        items: [],
        selection: "latest"
    }

    componentDidMount(): void {
        const reqUrl = `${this.props.source}/logs`;
        fetch(reqUrl).then(res => {
            if (res.ok) {
                res.json().then((logs: BuildLogRef[]) => {
                    const items: IDropdownOption<any>[] = logs.map(el => ({
                        key: el.time,
                        text: new Date(el.time).toLocaleString()
                    })).sort((a, b) => b.key - a.key);
                    this.setState({
                        items: items
                    });
                });
            }
        });
    }

    private readonly defaultOptions: IDropdownOption<any>[] = [
        {
            key: 'latest',
            text: 'Latest'
        },
        {
            key: 'divider_1',
            text: '-',
            itemType: DropdownMenuItemType.Divider
        }
    ];

    private onSelectionChange(e: React.FormEvent<HTMLDivElement>, option: IDropdownOption<any> | undefined) {
        if (option) {
            // Fetch log file
            let logTime: number;
            if (option.key === "latest") {
                // Return newest log
                logTime = Math.max(...this.state.items.map(el => el.key as number));
            }
            else {
                logTime = option.key as number;
            }
            this.setState({
                selection: option.key
            });
            this.props.onSelect(logTime);
        }
    }

    render(): React.ReactNode {
        return (
            <Dropdown
                placeholder="Select build log"
                dropdownWidth={200}
                selectedKey={this.state.selection}
                onChange={(e, option) => {
                    this.onSelectionChange(e, option);
                }}
                options={[...this.defaultOptions, ...this.state.items]}
            ></Dropdown>
        );
    }
}

interface BuildLogSelectProps {
    source: string;
    onSelect: (value: number) => void;
}

interface BuildLogRef {
    time: number,
    name: string
}