import { Dialog, DialogTrigger, Button, DialogSurface, DialogBody, DialogTitle, DialogContent, Field, Input, DialogActions } from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import Stack from "../../../../components/stack";
import type { IDialogBodyProps } from "../../../../components/IDialogBody";

interface NewEnvironmentVariableDialogProps {
    onSubmit: (key: string, value: string) => void
}

/**
 * Displays a dialogue window to create a new environment variable.
 * @param props 
 * @returns 
 */
export default function NewEnvironmentVariableDialog(props: NewEnvironmentVariableDialogProps) {
    const [open, setOpen] = useState(false);

    function onClose(data?: { key: string; value: string; }) {
        if (!data) {
            return;
        }
        props.onSubmit(data.key, data.value);
        setOpen(() => false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(evt, data) => {setOpen(() => data.open)}}
        >
            <DialogTrigger>
                <Button icon={<AddRegular />} appearance="primary">Create new</Button>
            </DialogTrigger>
            <DialogSurface>
                <Content close={onClose}/>
            </DialogSurface>
        </Dialog>
    );
}

function Content(props: IDialogBodyProps<{ key: string, value: string }>) {
    const keyInput = useRef<HTMLInputElement | null>(null);
    const valueInput = useRef<HTMLInputElement | null>(null);
    
    const [keyValid, setKeyValid] = useState(true);
    const [valValid, setValValid] = useState(true);

    function validateKey() {
        const key = keyInput.current?.value;
        if (!key || key.length == 0) {
            setKeyValid(() => false);
            return false;
        }
        return true;
    }

    function validateValue() {
        const value = valueInput.current?.value;
        if (!value || value.length == 0) {
            setValValid(false);
            return false;
        }
        return true;
    }

    function validate() {
        const _valueValid = validateValue();
        const _keyValid = validateKey();
        return _valueValid && _keyValid;
    }

    async function Submit() {
        if (!keyInput.current || !valueInput.current) {
            console.error("key or value input field refs missing.");
            return;
        }
        const shouldSet = validate();
        if (!shouldSet) {
            console.error("key or value fields' value not valid.");
            return;
        }
        const key = keyInput.current.value.toUpperCase();
        const value = valueInput.current.value;
        props.close({ key, value });
    }
    return (
        <DialogBody>
            <DialogTitle>Define New Environment Variable</DialogTitle>
            <DialogContent>
                <Stack gap={12} style={{ marginTop: 18, marginBottom: 18 }}>
                    <Stack horizontalFill gap={3}>
                        <Field
                            label={"Variable Name"}
                            validationState={ keyValid ? "none" : "error" }
                            validationMessage={keyValid ? "": "Providing a value is required."}
                            required
                        >
                            <Input
                                ref={keyInput}
                                placeholder="Name"
                                onChange={(_target, val) => {
                                    if (!keyInput.current) {
                                        return;
                                    }
                                    keyInput.current.value = val.value.toUpperCase();
                                    validateKey();
                                }}
                            />
                        </Field>
                    </Stack>
                    <Stack horizontalFill gap={3}>
                        <Field
                            label={"Value"}
                            validationState={ valValid ? "none" : "error" }
                            validationMessage={valValid ? "": "Providing a value is required."}
                            required
                        >
                            <Input
                                ref={valueInput}
                                placeholder="Value"
                                onChange={() => {
                                    validateValue();
                                }}
                            />
                        </Field>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button appearance="primary" autoFocus onClick={Submit}>Create</Button>
                <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
            </DialogActions>
        </DialogBody>
    );
}