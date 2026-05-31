import { useContext, useEffect, useMemo, useState } from "react";
import {
    Toolbar,
    Dialog,
    Text,
    Button,
    DialogTrigger,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Switch,
    Input,
    ToolbarGroup,
    Table,
    TableBody,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableCell,
    TableCellLayout,
    TableCellActions
} from "@fluentui/react-components";
import { AddRegular, CheckmarkRegular, DeleteRegular, DismissRegular, EditOffRegular, EditRegular, EyeFilled, EyeOffFilled } from "@fluentui/react-icons";
import Stack from "../../components/stack";
import { ProjectProvider } from "../../api/api";
import Section from "../../components/section";

export default function EnvironmentVariableEditor() {
    const project = useContext(ProjectProvider);

    const [env, setEnv] = useState<EnvironmentVariable[]>([]);
    const [showVariables, setVariableVisibility] = useState(false);

    async function refresh() {
        const env = await project?.getEnv();
        if (env) {
            const list: EnvironmentVariable[] = Object.keys(env).map(key => ({ key: key, value: env[key] }));
            setEnv(() => list);
        }
    }

    async function onDelete(key: string) {
        await project?.deleteEnv(key);
        refresh();
    }

    async function onValueChange(key: string, value: string) {
        await project?.setEnv(key, value);
        refresh();
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refresh();
    }, []);

    const rows = useMemo(() => {
        return env.map(variable => (
            <TableRow key={variable.key}>
                <TableCell style={{maxWidth: "12em"}}>
                    <Text truncate block>{ variable.key }</Text>
                </TableCell>
                <EnvironmentVariable
                    envKey={variable.key}
                    value={variable.value}
                    visible={showVariables}
                    onValueChange={(key, value) => {
                        onValueChange(key, value);
                    }}
                    onDelete={() => {
                        onDelete(variable.key);
                    }}
                />
            </TableRow>
        ));
    }, [env, showVariables])

    return (
        <Section
            title="Environment Variables"
        >
            <Stack horizontalFill>
                <Text
                    style={{marginBottom: 12}}
                >
                    Key-value pairs set here will be passed on to the application when deployed as environment vairables. These values are not encrypted and as such should be used with caution.
                    <p>
                        Restart the application for changes to take effect.
                    </p>
                </Text>
                <Toolbar style={{ justifyContent: "space-between" }}>
                    <ToolbarGroup>
                        <NewEnvironmentVariableDialog onAdded={refresh} />
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <Switch label={"Show all"} onChange={(_target, value) => { setVariableVisibility(value.checked)}}></Switch>
                    </ToolbarGroup>
                </Toolbar>
                <Stack>
                    <Table noNativeElements >
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell style={{maxWidth: "12em"}}>
                                    Key
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    Value 
                                </TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody
                            style={{
                                display: "block",
                                overflowY: "scroll",
                                height: 250
                            }}
                        >
                            {
                                ...rows
                            }
                        </TableBody>
                    </Table>
                </Stack>
            </Stack>
        </Section>
    )
}

interface EnvironmentVariable {
    key: string,
    value: string
}

/**
 * Retruns a table cell configured to display and edit an environment variable value.
 * @param props 
 * @returns 
 */
function EnvironmentVariable(props: EnvironmentVariableProps) {
    const [visible, toggleVisibility] = useState(props.visible);
    const [editable, toggleEdit] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value);

    function onVisibleClick() {
        toggleVisibility(!visible);
    }

    function onEditClick() {
        toggleEdit(!editable);
    }

    function onSaveValueClick() {
        onEditClick();
        props.onValueChange(props.envKey, editedValue);
    }

    // TODO: confirmation popup
    function onDeleteClick() {
        props.onDelete();
    }

    const showContent = ((visible == true) || (props.visible == true));

    return (
        <TableCell>
            <TableCellLayout>
                <Stack horizontal horizontalAlign="stretch" verticalAlign="center" gap={8} style={{ height: "100%", flexGrow: 1 }}>
                    {
                        !showContent && 
                        <Text>Hidden value. Click <em><EyeOffFilled/> show value</em> to view.</Text>
                    }
                    {
                        showContent && (
                            editable ? 
                                <Input
                                    style={{width: `100%`}}
                                    defaultValue={props.value}
                                    onChange={(_target, val) => {
                                        setEditedValue(val.value);
                                    }}
                                    contentAfter={
                                        <Stack gap={4} horizontal> 
                                            <Button appearance="subtle" icon={<CheckmarkRegular />} onClick={onSaveValueClick}/>
                                            <Button appearance="subtle" icon={<DismissRegular />} onClick={onEditClick}/>
                                        </Stack>
                                    }
                                />
                            :
                                <Stack gap={8} horizontal verticalAlign="center"> 
                                    <Text><code>{props.value}</code></Text>
                                </Stack>
                        )
                    }
                </Stack>
            </TableCellLayout>
            <TableCellActions>
                <Button
                    icon={visible ? <EyeFilled/> : <EyeOffFilled/>}
                    onClick={onVisibleClick}
                    appearance="subtle"
                />
                <Button
                    appearance="subtle"
                    icon={editable ? <EditOffRegular/> : <EditRegular />}
                    onClick={onEditClick}
                    disabled={ !visible }
                />
                <CancellableDeleteButton onConfirm={onDeleteClick} variableKey={ props.envKey }/>
            </TableCellActions>
        </TableCell>
    );
}

interface EnvironmentVariableProps {
    envKey: string,
    value: string,
    visible: boolean,
    onValueChange: (key: string, value: string) => void
    onDelete: () => void
}

/**
 * Displays a dialogue window to create a new environment variable.
 * @param props 
 * @returns 
 */
function NewEnvironmentVariableDialog(props: NewEnvironmentVariableDialogProps) {
    const project = useContext(ProjectProvider);

    const [key, setKey] = useState("");
    const [value, setValue] = useState("");

    if (!project) {
        throw new Error("No project instance was provided");
    }

    async function SetServerEnvVariable() {
        await project?.setEnv(key, value);
        if (props.onAdded) {
            props.onAdded();
        }
    }

    return (
        <Dialog>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular/>}>New Environment Variable</Button>
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Define New Environment Variable</DialogTitle>
                    <DialogContent>
                        <Stack gap={12} style={{marginTop: 18, marginBottom: 18}}>
                            <Input
                                placeholder="Key"
                                value={key}
                                onChange={(_target, val) => {
                                    setKey(`${val.value}`.toUpperCase());
                                }}
                            />
                            <Input
                                placeholder="Value"
                                value={value}
                                onChange={(_target, val) => {
                                    setValue(val.value || "");
                                }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="primary" autoFocus onClick={SetServerEnvVariable}>Create</Button>
                        </DialogTrigger>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}

interface NewEnvironmentVariableDialogProps {
    onAdded?: () => void
}

function CancellableDeleteButton(props: { onConfirm: () => void, variableKey: string }) {
    return (
        <Dialog modalType="alert">
            <DialogTrigger disableButtonEnhancement>
                <Button
                    appearance="subtle"
                    icon={<DeleteRegular></DeleteRegular>}
                />
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Delete environment variable?</DialogTitle>
                    <DialogContent>
                        <Stack gap={12} style={{marginTop: 18, marginBottom: 18}}>
                            <Text>Are you sure you want to delete <code>{ props.variableKey }</code>?</Text>
                            <Text weight="bold">This can not be undone.</Text>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="primary" onClick={props.onConfirm}>Delete</Button>
                        </DialogTrigger>
                        <DialogTrigger disableButtonEnhancement>
                            <Button autoFocus appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}