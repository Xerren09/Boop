import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, MenuItem, Spinner, Subtitle1, Text, Tooltip, type ButtonProps } from "@fluentui/react-components"
import type { ProjectStatus } from "../../../api/streamers/types"
import { DeleteFilled, PlayFilled, ReplayFilled, StopFilled, WarningColor } from "@fluentui/react-icons"
import { useContext, useState, type JSX } from "react";
import { BoopAPI, ProjectProvider } from "../../../api/api";
import Stack from "../../stack";

const buttonTypes: {[key in ButtonAction]: ButtonData} = {
    "start": {
        disableOn: "deployed",
        icon: <PlayFilled color="green" />,
        label: "Deploy"
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
    const [dialogueOpen, setDialogueOpen] = useState<boolean>(false);
    const [tooltipEnabled, setTooltipEnabled] = useState<boolean>(false);

    const projectId: string | undefined = project ? project.name : props.projectId;

    if (!projectId) {
        throw new Error(`Prop "projectId" must be given if no "ProjectProvider" context is available.`);
    }

    const invokeCallback = async () => {
        try {
            setBusy(true);
            await fetch(getAPICallURL(projectId, props.action), { method: "POST"});
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

    const showCancellationDialogue = () => {
        setDialogueOpen(true);
    }

    const buttonInfo = buttonTypes[props.action];
    const icon = busy ? <Spinner size="extra-tiny" /> : buttonInfo.icon;
    const onClick = props.cancellable ? showCancellationDialogue : invokeCallback;
    const disabled = busy || buttonInfo.disableOn === null ? false : props.projectState === buttonInfo.disableOn;
    const children = props.hideLabel === true ? undefined : (<Text weight="semibold">{buttonInfo.label}</Text>);

    return (
        <>
            <Tooltip
                content={buttonInfo.label}
                relationship="label"
                visible={(tooltipEnabled && (props.hideLabel ?? false))}
                onVisibleChange={
                    (_ev, data) => setTooltipEnabled(data.visible)
                }
            >   
                {
                    props.asMenuItem ?
                            //@ts-expect-error ...props
                            <MenuItem
                                icon={icon}
                                onClick={onClick}
                                disabled={disabled}
                                children={children}
                                {...props}
                            />
                        :
                            //@ts-expect-error ...props
                            <Button
                                icon={icon}
                                onClick={onClick}
                                disabled={disabled}
                                children={children}
                                {...props}
                            />
                }
            </Tooltip>
            {
                props.cancellable && <Dialog open={ dialogueOpen } modalType="alert">
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>
                                <Stack verticalAlign="end" horizontal gap={8}>
                                    <WarningColor fontSize={24} />
                                    <Subtitle1>{buttonInfo.label} { project?.name }?</Subtitle1>
                                </Stack>
                            </DialogTitle>
                            <DialogContent>
                                <Stack gap={8} horizontalFill>
                                    <Text>Are you sure you want to {buttonInfo.label.toLocaleLowerCase()} this project?</Text>
                                    {
                                        buttonInfo.label === "Delete" &&
                                        <Text weight="bold">This can not be undone.</Text>
                                    }
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="primary" onClick={() => { setDialogueOpen(false); invokeCallback(); }}>Delete</Button>
                                </DialogTrigger>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" autoFocus onClick={() => { setDialogueOpen(false); }}>Cancel</Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            }
        </>
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
    cancellable?: boolean,
    asMenuItem?: boolean
    /**
     * Callback that fires when the action completed.
     * @param err 
     * @returns 
     */
    onSettled?: (err?: unknown) => void
} & Omit<ButtonProps, "disabled" | "icon" | "onClick">

type ButtonAction = "start" | "stop" | "restart" | "delete";

type ButtonData = {
    disableOn: ProjectStatus | null,
    icon: JSX.Element,
    label: string
}