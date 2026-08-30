import { Dialog, DialogTrigger, Button, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Text, Accordion, AccordionItem, AccordionHeader, AccordionPanel, Switch } from "@fluentui/react-components";
import { APIError } from "../../api/api";
import { useEffect, useState } from "react";
import { DismissCircleColor } from "@fluentui/react-icons";
import {serializeError } from 'serialize-error';
import Stack from "../../components/stack";
import type { Observable } from "rxjs";

type ErrorType = "connection" | "generic";

const statusHeadingMap: { [key in NonNullable<ErrorType>]: string } = {
    "connection": "An error occured while trying to communicate with Boop. This usually means Boop is not running.",
    "generic": "Boop has returned an error:",
}

interface ErrorItem {
    details: string,
    title: string
}

export function APIErrorDialog(props: { errorStream: Observable<unknown>, onDismiss?: () => void }) {
    const [open, setOpen] = useState<boolean>(false);
    const [errors, setErrors] = useState<ErrorItem[]>([]);
    const [type, setType] = useState<ErrorType>("generic");
    const [showList, setListVisibility] = useState<boolean>(false);

    function handleError(err: unknown) {
        setOpen(() => true);
        if (err instanceof APIError) {
            setType(() => "connection");
        }
        else {
            setType(() => "generic");
        }
        const message = err instanceof Error ? err.message : "Error"
        const serialised = serializeError(err);
        const text = JSON.stringify(serialised, null, 2);
        setErrors(_arr => [..._arr, {
            details: text,
            title: message
        }]);
    }

    useEffect(() => {
        if (!props.errorStream) {
            return;
        }
        const sub = props.errorStream.subscribe((err) => {
            handleError(err);
        });
        return () => {
            sub.unsubscribe();
        }
    }, [props.errorStream]);

    function onOpenChange(newOpenState: boolean) {
        setOpen(() => newOpenState);
        if (newOpenState === false) {
            setErrors(() => []);
            setType(() => "generic");
            setListVisibility(() => false);
            if (props.onDismiss) {
                props.onDismiss();
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={(evt, data) => {onOpenChange(data.open)}}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <Stack horizontal gap={6} verticalAlign="center"><DismissCircleColor fontSize={26}/>Uh oh!</Stack>
                    </DialogTitle>
                    <DialogContent>
                        <Stack gap={18}>
                            <Text>
                                {
                                    statusHeadingMap[type]
                                }
                            </Text>
                            {
                                type == "generic" && <ErrorList errors={errors}/>
                            }
                            {
                                type == "connection" && errors.length > 1 &&
                                (
                                    <div>
                                        <Switch size="small" label={"Show Error list"} onChange={(evt, data) => { setListVisibility(data.checked) }}/>
                                    </div>
                                )
                            }
                            {
                                type == "connection" && showList == true && <ErrorList errors={errors}/>
                            }
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button autoFocus appearance="primary">Dismiss</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}

function ErrorList(props: {errors: ErrorItem[]}) {
    return (
        <div style={{maxHeight: "30vh", overflow: "auto"}}>
            <Accordion multiple collapsible>
                    {
                        props.errors.map((err, idx) => (
                            <AccordionItem value={idx}>
                                <AccordionHeader>
                                    {
                                        err.title
                                    }
                                </AccordionHeader>
                                <AccordionPanel>
                                    <pre>
                                        { err.details }
                                    </pre>
                                </AccordionPanel>
                            </AccordionItem>
                        ))
                    }
            </Accordion>
        </div>
    );
}