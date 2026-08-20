import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ProjectProvider, type WebhookEvent } from "../../api/api";
import Section from "../../components/section";
import { useSearchParams } from "react-router";
import WebhookEventList from "../../components/eventList";

const REFRESH_DEBOUNCE_MS = 1500;
/**
 * 
 * @param props 
 * @returns 
 */
export default function ProjectWebhookEventsTab(props: { refreshKey?: unknown }) {
    const project = useContext(ProjectProvider);
    const [events, setEvents] = useState<WebhookEvent[]>([]);

    const [searchParams] = useSearchParams();

    const referredEventRef = useMemo(() => {
        return searchParams.get("eventRef") ?? "";
    }, [searchParams]);

    const getEvents = useCallback(async () => {
        const webhookEvents = await project?.getWebhookLog();
        if (webhookEvents) {
            webhookEvents.reverse();
            setEvents(() => webhookEvents);
        }
    }, [project]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        getEvents();
    }, [getEvents, project]);

    useEffect(() => { 
        const id = setTimeout(() => {
            getEvents();
        }, REFRESH_DEBOUNCE_MS);
        return () => {
            clearTimeout(id);
        };
    }, [getEvents, props.refreshKey]);

    return(
        <Section
            title="Received events"
            style={{
                height: "100%"
            }}
        >
            <WebhookEventList
                events={events}
                highlightId={referredEventRef}
                style={{maxHeight: "50vh", height: "50vh"}}
            /> 
        </Section>
    )
}