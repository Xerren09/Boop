import { useState, useEffect, useCallback } from "react";

type Enum<E> = Record<keyof E, number | string> & { [k: number]: string };

function getHashNavTargetValue<T extends Enum<T>>(tabs: T) {
    const hashTab = window.location.hash.substring(1, window.location.hash.length);
    if (hashTab.length == 0) {
        return 0;
    }
    const value = tabs[hashTab as keyof typeof tabs];
    return value;
}

export default function useHashTabs<T extends Enum<T>>(tabs: T) {
    const [currentTab, setCurrentTab] = useState<number | string>(() => getHashNavTargetValue(tabs));
    
    /**
     * Effect for synchronising window location hash with the current tab
     */
    useEffect(() => {
        const tabHash = `#${tabs[currentTab as keyof typeof tabs]}`;
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
            const tabHash = `#${tabs[currentTab as number] ?? ''}`;
            if (window.location.hash == tabHash) {
                return;
            }
            console.log("hashchange:", "changing tabs", "from", `${tabs[currentTab as number]}`, "to", `${window.location.hash}`);
            const hashEnumValue = getHashNavTargetValue(tabs);
            setCurrentTab(() => hashEnumValue);
        };
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [currentTab]);

    const switchTab = useCallback((tab: number | string) => {setCurrentTab(() => tab)}, [])

    return {
        currentTab,
        switchTab
    }
}