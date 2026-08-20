import { useApplyScrollbarWidth } from "@fluentui/react-components";
import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Hook that hides or shows the scroll offset when the table body container passed is overflowing.
 * @param element 
 * @returns 
 */
export default function useTableScrollWidthOffset(element?: HTMLElement | null) {
    const scrollWidthAlignRef = useApplyScrollbarWidth();
    const [scrollOffsetVisible, setScrollOffset] = useState(false);

    useLayoutEffect(() => {
        if (element) {
            const shouldOffset = element.clientHeight < element.scrollHeight;
            if (scrollOffsetVisible != shouldOffset) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setScrollOffset(() => shouldOffset);
            }
        }
    });

    const apply = useCallback((instance?: HTMLElement | null) => {
        if (!instance) {
            return;
        }
        if (scrollOffsetVisible) {
            instance.removeAttribute("hidden");
            scrollWidthAlignRef(instance);
        }
        else {
            instance.setAttribute("hidden", "");
        }
    }, [scrollOffsetVisible, scrollWidthAlignRef]);

    return apply;
}