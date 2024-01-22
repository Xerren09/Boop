import React, { useEffect, useState } from "react";
import { getApiString } from "../../util";
import { CommandBar, DefaultButton, DetailsList, DetailsListLayoutMode, Dialog, DialogFooter, DialogType, IColumn, ICommandBarItemProps, IconButton, PrimaryButton, SelectionMode, Stack, Text, TextField } from "@fluentui/react";

export class EnvironmentVariableEditor extends React.Component<{ projectId: string, dismiss: () => void }, EnvState> {
    
    state: Readonly<EnvState> = {
        items: [],
        columns: [
            {
                key: "name",
                name: "Name",
                minWidth: 100,
                maxWidth: 250,
                currentWidth: 100,
                isResizable: true,
                onRender: (item: EnvEntry) => (
                    <Stack verticalFill verticalAlign="center">
                        <Text>{ item.key }</Text>
                    </Stack>
                ),
            },
            {
                key: "value",
                name: "Value",
                minWidth: 150,
                isResizable: true,
                onRender: (item: EnvEntry) => (
                    <EnvValue
                        item={item}
                        visible={this.state.showAll}
                        onValueChange={this.onKeyUpdate}
                    ></EnvValue>
                ),
            },
            {
                key: "delete",
                name: "Delete",
                minWidth: 75,
                maxWidth: 75,
                onRender: (item: EnvEntry) => (
                    <Stack verticalFill verticalAlign="center">
                        <IconButton
                            iconProps={{ iconName: "Delete" }}
                            onClick={() => {
                                const items = [...this.state.items];
                                const index = items.findIndex(el => el.key === item.key);
                                if (index != -1) {
                                    items.splice(index, 1);
                                    this.setState({
                                        items: [...items]
                                    });
                                }
                            }}
                        ></IconButton>
                    </Stack>
                ),
            }
        ],
        showAll: false,
        hideDialog: true,
        env: {},
    };

    componentDidMount(): void {
        this.getEnv();
    }

    private getEnv() {
        fetch(`${getApiString()}/projects/${this.props.projectId}/env`).then(res => {
            res.json().then(env => {
                this.setState({
                    items: Object.keys(env).map(el => ({
                        key: el,
                        value: env[el]
                    })),
                    env: env
                })
            });
        })
    }

    private onKeyUpdate = (key: string, value: string) => {
        const items = [...this.state.items];
        const index = items.findIndex(el => el.key === key);
        if (index != -1) {
            items[index].value = value;
        }
        else {
            items.push({ key: key, value: value });
        }
        this.setState({
            items: [...items]
        });
    }

    private saveKeys() {
        let keys: any = {};
        this.state.items.forEach(el => {
            keys[el.key] = el.value;
        });
        for (const key of Object.keys(keys)) {
            if (this.state.env[key] === undefined || this.state.env[key] !== keys[key]) {
                fetch(`${getApiString()}/projects/${this.props.projectId}/env`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        key: key,
                        value: keys[key]
                    })
                });
            }
        }
        for (const key of Object.keys(this.state.env)) {
            if (keys[key] === undefined) {
                fetch(`${getApiString()}/projects/${this.props.projectId}/env`, {
                    method: 'DELETE',
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        key: key
                    })
                });
            }
        }
    }

    commandBarItems: ICommandBarItemProps[] = [
        {
            key: 'add',
            text: 'New environment variable',
            iconProps: { iconName: 'Add' },
            onClick: () => {
                this.setState({ hideDialog: false });    
            },
        },
        {
            key: 'showAll',
            text: 'Show values',
            iconProps: { iconName: 'RedEye' },
            onClick: () => {
                this.setState({
                    items: [...this.state.items],
                    showAll: !this.state.showAll
                })
            },
        }
    ]

    render(): React.ReactNode {
        return (
            <Stack style={{ width: "75vw", maxWidth: 1000, maxHeight: "75vh", padding: 16 }}>
                <Stack horizontal horizontalAlign="space-between">
                    <Text variant="xLarge">Environment variables</Text>
                    <IconButton iconProps={{iconName: "Cancel"}} onClick={() => { this.props.dismiss() }}></IconButton>
                </Stack>
                <Text
                    style={{marginTop: 12, marginBottom: 12}}
                >
                    Key-value pairs set here will be passed on to the application when deployed. These values are not encrypted and as such should be used with caution.
                    
                    Restart the application for changes to take effect.
                </Text>
                <CommandBar
                    items={this.commandBarItems}
                    style={{marginLeft: -24}}
                />
                <DetailsList
                    styles={{root: {maxHeight: "50vh", scrollbarGutter: "stable", overflowY: "auto", overflowX: "hidden" }}}
                    items={this.state.items}
                    columns={this.state.columns}
                    selectionMode={SelectionMode.none}
                    setKey="none"
                    layoutMode={DetailsListLayoutMode.justified}
                    isHeaderVisible={true}
                />
                <Stack horizontal horizontalAlign="end" tokens={{childrenGap: 8}} style={{marginTop: 12}}>
                    <PrimaryButton onClick={() => { this.saveKeys(); this.props.dismiss(); }} text="Save" />
                    <DefaultButton onClick={() => { this.props.dismiss(); }} text="Don't save" />
                </Stack>

                {
                    // ----------------------------------------
                }

                <Dialog
                    hidden={this.state.hideDialog}
                    dialogContentProps={{
                        type: DialogType.normal,
                        title: 'Enter variable name',
                    }}
                    onDismiss={() => {
                        this.setState({ hideDialog: true });
                    }}
                >
                    <NewVariable
                        onDismiss={() => {
                            this.setState({ hideDialog: true });
                        }}
                        onAddKey={(key: string) => {
                            this.onKeyUpdate(key, "");
                        }}
                    ></NewVariable>
                </Dialog>
            </Stack>
        );
    }
}

interface EnvState {
    items: EnvEntry[];
    columns: IColumn[];
    showAll: boolean;
    hideDialog: boolean;
    env: any;
}

interface EnvEntry {
    key: string;
    value: string;
}

function EnvValue(props: {item: {value: string, key: string}, visible: boolean, onValueChange: (key: string, value: string) => void}) {
    const [visible, setVisibility] = useState(false);

    useEffect(() => {
        setVisibility(props.visible);
    }, [props.visible]);

    return (
        <Stack horizontal horizontalAlign="stretch" verticalAlign="center" tokens={{childrenGap: 8}} style={{height: "100%"}}>
            <IconButton
                toggle
                checked={visible}
                iconProps={visible ? { iconName: "Hide" } : { iconName: "RedEye" }}
                onClick={() => {setVisibility(!visible)}}
            ></IconButton>
            {
                visible ?
                    <TextField
                        styles={{ root: { width: "100%" } }}
                        value={props.item.value}
                        onChange={(target, val) => {
                            props.onValueChange(props.item.key, val || props.item.value);
                        }}
                    />
                    :
                    <Text>Hidden value. Click show value to view.</Text>
            }
        </Stack>
    );
}

function NewVariable(props: { onDismiss: () => void, onAddKey: (key: string) => void }) {

    const [name, setName] = useState("");

    return (
        <>
            <Stack>
                <TextField
                    styles={{ root: { width: "100%" } }}
                    value={name}
                    onChange={(target, val) => {
                        setName(val || "");
                    }}
                />
            </Stack>
            <DialogFooter>
                <PrimaryButton
                    onClick={() => {
                        props.onAddKey(name);
                        props.onDismiss();
                    }}
                    text="Create"
                />
                <DefaultButton
                    onClick={() => {
                        props.onDismiss();
                    }}
                    text="Cancel"
                />
            </DialogFooter>
        </>
    );
}