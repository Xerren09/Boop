import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    Toolbar,
    Text,
    Button,
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
    TableCellActions,
    useApplyScrollbarWidth,
} from "@fluentui/react-components";
import { CheckmarkRegular, DismissRegular, EditOffRegular, EditRegular, EyeFilled, EyeOffFilled } from "@fluentui/react-icons";
import Stack from "../../components/stack";
import { ProjectProvider } from "../../api/api";
import Section from "../../components/section";
import CancellableDeleteButton from "./tabs/env/CancelDeleteDialog";
import NewEnvironmentVariableDialog from "./tabs/env/NewEnvDialog";

type EnvironmentVariable  = {
    key: string,
    value: string
}

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
        refresh();
    }, []);

    const rows = useMemo(() => {
        return env.map(variable => (
            <TableRow key={variable.key}>
                <TableCell>
                    <TableCellLayout truncate>
                        <Text>{ variable.key }</Text>
                    </TableCellLayout>
                </TableCell>
                <EnvironmentVariable
                    env={variable}
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

    const scrollWidthAlignRef = useApplyScrollbarWidth();

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
                        <NewEnvironmentVariableDialog onSubmit={onValueChange}/>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <Switch label={"Show all"} onChange={(_target, value) => { setVariableVisibility(value.checked)}}></Switch>
                    </ToolbarGroup>
                </Toolbar>
                <Stack>
                    <Table noNativeElements>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>
                                    Key
                                </TableHeaderCell>
                                <TableHeaderCell style={{flexGrow: 3}}>
                                    Value 
                                </TableHeaderCell>
                                <div role="presentation" ref={scrollWidthAlignRef} />
                            </TableRow>
                        </TableHeader>
                        <TableBody
                            style={{
                                display: "block",
                                overflowY: "auto",
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

/**
 * Retruns a table cell configured to display and edit an environment variable value.
 * @param props 
 * @returns 
 */
function EnvironmentVariable(props: EnvironmentVariableProps) {
    const [visible, toggleVisibility] = useState(props.visible);
    const [editable, toggleEdit] = useState(false);

    const editField = useRef<HTMLInputElement | null>(null);

    function onVisibleClick() {
        toggleVisibility(!visible);
    }

    function onEditClick() {
        toggleEdit(!editable);
    }

    function onSaveValueClick() {
        if (!editField.current) {
            console.error("Editfield ref missing.");
            return;
        }
        onEditClick();
        props.onValueChange(props.env.key, editField.current.value);
    }

    function onDeleteClick() {
        props.onDelete();
    }

    const showContent = ((visible == true) || (props.visible == true));

    return (
        <TableCell style={{flexGrow: 3}}>
            <TableCellLayout>
                {
                    !showContent && 
                    <Text>Hidden value. Click <em><EyeOffFilled/></em> to view.</Text>
                }
                {
                    showContent && (
                        editable ? 
                            <Input
                                ref={editField}
                                style={{width: `100%`}}
                                defaultValue={props.env.value}
                                contentAfter={
                                    <Stack gap={4} horizontal> 
                                        <Button title="Save" appearance="subtle" icon={<CheckmarkRegular />} onClick={onSaveValueClick}/>
                                        <Button title="Dismiss" appearance="subtle" icon={<DismissRegular />} onClick={onEditClick}/>
                                    </Stack>
                                }
                            />
                        :
                        <Text><code>{props.env.value}</code></Text>
                    )
                }
            </TableCellLayout>
            {
                !editable && <TableCellActions>
                    <Button
                        icon={showContent ? <EyeFilled/> : <EyeOffFilled/>}
                        onClick={onVisibleClick}
                        appearance="subtle"
                    />
                    <Button
                        appearance="subtle"
                        icon={editable ? <EditOffRegular/> : <EditRegular />}
                        onClick={onEditClick}
                        disabled={ !showContent }
                    />
                    <CancellableDeleteButton onConfirm={onDeleteClick} variableKey={ props.env.key }/>
                </TableCellActions>
            }
        </TableCell>
    );
}

interface EnvironmentVariableProps {
    env: EnvironmentVariable,
    visible: boolean,
    onValueChange: (key: string, value: string) => void
    onDelete: () => void
}