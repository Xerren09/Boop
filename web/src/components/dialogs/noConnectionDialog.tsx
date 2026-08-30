import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger, Button } from "@fluentui/react-components";
import { WarningColor } from "@fluentui/react-icons";
import Stack from "../stack";

export function NoConnectionAlert(props: { open: boolean, onDismiss: () => void }) {
    return (
        <Dialog
            // this controls the dialog open state
            open={props.open}
            onOpenChange={() => {
                props.onDismiss();
            }}
            modalType="alert"
        >
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <Stack horizontal gap={6} verticalAlign="center">
                            <WarningColor fontSize={26}/> Connection lost
                        </Stack>
                    </DialogTitle>
                    <DialogContent>
                        An error occured while trying to communicate with Boop
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Dismiss</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}