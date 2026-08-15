import { Dialog, DialogTrigger, Button, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Text } from "@fluentui/react-components";
import { DeleteRegular } from "@fluentui/react-icons";

export default function CancellableDeleteButton(props: { onConfirm: () => void, variableKey: string }) {
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
                    <DialogTitle>Delete '<code>{props.variableKey}</code>'</DialogTitle>
                    <DialogContent>
                        <Text>This action is permanent. Are you sure you want to continue?</Text>
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