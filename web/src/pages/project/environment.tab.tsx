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
    makeStyles,
} from "@fluentui/react-components";
import { CheckmarkRegular, DismissRegular, EditOffRegular, EditRegular, EyeFilled, EyeOffFilled } from "@fluentui/react-icons";
import Stack from "../../components/stack";
import { ProjectProvider } from "../../api/api";
import Section from "../../components/section";
import CancellableDeleteButton from "./tabs/env/CancelDeleteDialog";
import NewEnvironmentVariableDialog from "./tabs/env/NewEnvDialog";
import useTableScrollWidthOffset from "../../components/useTableScrollWidthOffset";

const tableStyles = makeStyles({
    keyCol: {
        minWidth: "20ch", //"150px"
    },
    valCol: {
        flexGrow: 3,
        minWidth: "40ch" //"200px"
    }
});

type EnvironmentVariable  = {
    key: string,
    value: string
}

export default function EnvironmentVariableEditor() {
    const project = useContext(ProjectProvider);

    const style = tableStyles();

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
            <EnvironmentVariable
                key={variable.key}
                variable={variable}
                visible={showVariables}
                onValueChange={(key, value) => {
                    onValueChange(key, value);
                }}
                onDelete={() => {
                    onDelete(variable.key);
                }}
            />
        ));
    }, [env, showVariables])

    const list = useRef<HTMLDivElement | null>(null);
    const scrollWidthAlignRef = useTableScrollWidthOffset(list.current);

    return (
        <Section
            title="Environment Variables"
        >
            <Stack horizontalFill verticalFill>
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
                <Stack horizontalFill verticalFill style={{overflowX: "auto"}}>
                    <Table noNativeElements style={{width: "100%", minWidth: "500px"}}>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell className={style.keyCol}>
                                    Key
                                </TableHeaderCell>
                                <TableHeaderCell className={style.valCol}>
                                    Value 
                                </TableHeaderCell>
                                <div role="presentation" ref={scrollWidthAlignRef} />
                            </TableRow>
                        </TableHeader>
                        <TableBody
                            style={{
                                width: "100%",
                                maxHeight: "50vh",
                                overflowY: "auto"
                            }}
                            ref={list}
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
    const style = tableStyles();

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
        props.onValueChange(props.variable.key, editField.current.value);
    }

    function onDeleteClick() {
        props.onDelete();
    }

    const showContent = ((visible == true) || (props.visible == true));

    return (
        <TableRow>
            <TableCell className={style.keyCol}>
                <TableCellLayout truncate>
                    <Text block style={{wordBreak: "break-all"}}><code>{ props.variable.key }</code></Text>
                </TableCellLayout>
            </TableCell>
            <TableCell className={style.valCol}>
                <Stack horizontal horizontalFill gap={6} horizontalAlign="space-between" verticalAlign="center">
                    {
                        !showContent && 
                        <Text>Hidden value. Click <em><EyeFilled/></em> to view.</Text>
                    }
                    {
                        showContent && (
                            editable ? 
                                <Input
                                    ref={editField}
                                    style={{width: `calc(100% - 115px)`}}
                                    defaultValue={props.variable.value}
                                    contentAfter={
                                        <Stack gap={4} horizontal> 
                                            <Button title="Save" appearance="subtle" icon={<CheckmarkRegular />} onClick={onSaveValueClick}/>
                                            <Button title="Dismiss" appearance="subtle" icon={<DismissRegular />} onClick={onEditClick}/>
                                        </Stack>
                                    }
                                />
                            :
                            <Text block style={{maxWidth: `calc(100% - 115px)`, wordBreak: "break-word"}}><code>{props.variable.value}</code></Text>
                        )
                    }
                    {
                        !editable && <Stack horizontal gap={6}>
                            <Button
                                icon={showContent ? <EyeOffFilled/> : <EyeFilled/>}
                                onClick={onVisibleClick}
                                appearance="subtle"
                            />
                            <Button
                                appearance="subtle"
                                icon={editable ? <EditOffRegular/> : <EditRegular />}
                                onClick={onEditClick}
                                disabled={ !showContent }
                            />
                            <CancellableDeleteButton onConfirm={onDeleteClick} variableKey={ props.variable.key }/>
                        </Stack> 
                    }
                </Stack>
            </TableCell>
        </TableRow>
    );
}

interface EnvironmentVariableProps {
    variable: EnvironmentVariable,
    visible: boolean,
    onValueChange: (key: string, value: string) => void
    onDelete: () => void
}