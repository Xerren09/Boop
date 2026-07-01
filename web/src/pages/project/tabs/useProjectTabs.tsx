import { useState, useEffect, useCallback } from "react";
import { ProjectTab } from "./tabs.enum";

function getFirstNavTargetTab() {
    const hashTab = window.location.hash.substring(1, window.location.hash.length);
    if (hashTab.length == 0) {
        return 0;
    }
    const tabIdx = ProjectTab[(hashTab) as keyof typeof ProjectTab];
    return tabIdx;
}

export default function useProjectTabs() {
    const [currentTab, setCurrentTab] = useState<ProjectTab>(getFirstNavTargetTab);
    
    /**
     * Effect for synchronising window location hash with the current tab
     */
    useEffect(() => {
        const tabHash = `#${ProjectTab[currentTab]}`;
        if (currentTab == undefined || window.location.hash == tabHash) {
            return;
        }
        window.location.hash = tabHash;
        // HACK: Clear out any query params when navigating between tabs
        const newUrl = new URL(window.location.href);
        newUrl.search = "";
        window.history.pushState(null, '', newUrl);
    }, [currentTab]);

    /**
     * Effect for handling window location hash changes, and switching tabs accordingly
     */
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash.length == 0) {
                return;
            }
            if (currentTab == undefined) {
                return;
            }
            const tabHash = `#${ProjectTab[currentTab] ?? ''}`;
            if (window.location.hash == tabHash) {
                return;
            }
            console.log("changing tabs", "from", `${ProjectTab[currentTab]}`, "to", window.location.hash);
            const hashTargetTab = window.location.hash.substring(1, window.location.hash.length);
            const tabIdx = ProjectTab[hashTargetTab as keyof typeof ProjectTab] as number;
            setCurrentTab(() => tabIdx);
        };
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [currentTab]);

    const switchTab = useCallback((tab: ProjectTab) => {setCurrentTab(() => tab)}, [])

    return {
        currentTab,
        switchTab
    }
}