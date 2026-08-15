import { useEffect, useState } from "react";

export default function useMediaQuery(query: string) {
    const [matches, setMatch] = useState<boolean>(false);

    useEffect(() => {
        const handler = (ev: MediaQueryListEvent) => {
            setMatch(() => ev.matches);
        };
        const _query = window.matchMedia(query);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMatch(() => _query.matches);
        _query.addEventListener("change", handler);
        return () => {
            _query.removeEventListener("change", handler);
        }
    }, [query]);

    return matches;
}