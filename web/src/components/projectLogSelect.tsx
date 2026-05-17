import { Divider, Dropdown, Listbox, Option, type ComboboxOpenChangeData, type ComboboxOpenEvents } from "@fluentui/react-components";
import { useContext, useState } from "react";
import { ProjectProvider, type EventLog } from "../api/api";

export default function ProjectLogSelect(props: Props) {
    const project = useContext(ProjectProvider);
    const [options, setOptions] = useState<EventLog[]>([]);

    if (project === null) {
        throw new Error(`Prop "projectId" must be given if no "ProjectProvider" context is available.`);
    }

    async function onOpen(_: ComboboxOpenEvents, data: ComboboxOpenChangeData) {
        if (data.open) {
            const reqUrl = props.build ? project!.listDeployLogs() : project!.listInstallLogs();
            const files = await reqUrl;
            setOptions(() => files.sort((a, b) => b.time - a.time));
        }
    }

    function onSelect(index: number) {
        if (options.length == 0) {
            return;
        }
        props.onSelect(options[index]);
    }

    return (
        <Dropdown
            placeholder="Select log"
            style={{
                width: 200
            }}
            defaultValue={"Live"}
            onOpenChange={onOpen}
            onOptionSelect={(_evt, data) => {
                if (data.optionValue != undefined) {
                    if (data.optionValue === "latest") {
                        return onSelect(0);
                    }
                    if (data.optionValue === "live") {
                        return props.onSelect(null);
                    }
                    const index = Number.parseInt(data.optionValue);
                    if (Number.isNaN(index)) {
                        throw new Error(`Invalid selected option "${data.optionValue}".`);
                    }
                    onSelect(index);
                }
            }}
        >
            <Listbox style={{maxHeight: "50vh"}}>
                <Option value="live">Live</Option>
                <Divider></Divider>
                <Option value="latest">Latest</Option>
                <Divider></Divider>
                {
                    options.map((file, index) => <Option key={file.time} value={`${index}`}>{new Date(file.time).toLocaleString()}</Option>)
                }
            </Listbox>
        </Dropdown>
    );
}

type Props = {
    install?: never;
    build: true;
    onSelect: (file: EventLog | null) => void;
} | {
    install: true;
    build?: never;
    onSelect: (file: EventLog | null) => void;
}
