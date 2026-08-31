import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button } from "@fluentui/react-components";
import { WarningColor } from "@fluentui/react-icons";
import Stack from "../stack";
import { useNavigate } from "react-router";

export function ProjectDisposedAlert(props: { open: boolean }) {
    const nav = useNavigate();

    return (
        <Dialog
            open={props.open}
            modalType="alert"
        >
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <Stack horizontal gap={6} verticalAlign="center">
                            <WarningColor fontSize={26}/> Project unavailable
                        </Stack>
                    </DialogTitle>
                    <DialogContent>
                        This project is not available. This might be because Boop is shutting down, or the project was deleted.
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={() => { nav("/") }}>Back to Dashboard</Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}