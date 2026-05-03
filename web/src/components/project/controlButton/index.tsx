import { Button, Spinner, Text, Tooltip, type ButtonProps } from "@fluentui/react-components"
import type { ProjectStatus } from "../../../api/streamers/types"
import { DeleteFilled, PlayFilled, ReplayFilled, StopFilled } from "@fluentui/react-icons"
import { useContext, useState, type JSX } from "react";
import { BoopAPI, ProjectProvider } from "../../../api/api";

const buttonTypes: {[key in ButtonAction]: ButtonData} = {
    "start": {
        disableOn: "deployed",
        icon: <PlayFilled color="green" />,
        label: "Start"
    },
    "stop": {
        disableOn: "stopped",
        icon: <StopFilled color="red" />,
        label: "Stop"
    },
    "restart": {
        disableOn: "stopped",
        icon: <ReplayFilled color="orange" />,
        label: "Restart"
    },
    "delete": {
        disableOn: null,
        icon: <DeleteFilled color="red" />,
        label: "Delete"
    }
}

function getAPICallURL(projectId: string, action: ButtonAction) {
    return BoopAPI.constructApiURL(`projects/${projectId}/${action}`)
}

export default function ProjectControlButton(props: Props) {
    const project = useContext(ProjectProvider);
    const [busy, setBusy] = useState<boolean>(false);

    const projectId: string | undefined = project ? project.name : props.projectId;

    // FIXME: this should be just !projectId
    if (project !== null && !project && !props.projectId) {
        throw new Error(`Prop "projectId" must be given if no "ProjectProvider" context is available.`);
    }

    const invokeCallback = async () => {
        try {
            setBusy(true);
            // FIXME: remove ! from projectId
            await fetch(getAPICallURL(projectId!, props.action), { method: "POST"});
            if (props.onSettled) {
                props.onSettled();
            }
        }
        catch (err) {
            if (props.onSettled) {
                props.onSettled(err);
            }
            console.error(err);
        }
        finally {
            setBusy(false);
        }
    }

    const buttonInfo = buttonTypes[props.action];

    return (
        <Tooltip content={buttonInfo.label} relationship="label">
            {/* 
            //@ts-expect-error ...props */}
            <Button
                icon={busy ? <Spinner size="extra-tiny" /> : buttonInfo.icon}
                onClick={invokeCallback}
                disabled={busy || buttonInfo.disableOn === null ? false : props.projectState === buttonInfo.disableOn}
                children={props.hideLabel === true ? undefined : (<Text weight="semibold">{ buttonInfo.label }</Text>)}
                {...props}
            />
        </Tooltip>
    );
}

type Props = {
    action: ButtonAction,
    /**
     * The current state of the project. This is used to selectively disable the button when appropriate.
     */
    projectState?: ProjectStatus,
    /**
     * The project's ID (name). Optional if the button is used inside a {@link ProjectProvider} context, otherwise required.
     */
    projectId?: string,
    hideLabel?: boolean,
    /**
     * Callback that fires when the action completed.
     * @param err 
     * @returns 
     */
    onSettled?: (err?: unknown) => void
} & Omit<ButtonProps, "disabled" | "icon">

type ButtonAction = "start" | "stop" | "restart" | "delete";

type ButtonData = {
    disableOn: ProjectStatus | null,
    icon: JSX.Element,
    label: string
}