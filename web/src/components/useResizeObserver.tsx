import { useEffect, useState } from "react";

export default function useResizeObserver(element: Element, callback: ResizeObserverCallback, options?: ResizeObserverOptions) {
    const [obs, setObs] = useState<ResizeObserver|undefined>(undefined);

    useEffect(() => {
        const observer = new ResizeObserver(callback);
        observer.observe(element, options);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setObs(() => observer);
        return () => {
            observer.disconnect();
        }
    }, [callback, element, options]);

    return obs;
}