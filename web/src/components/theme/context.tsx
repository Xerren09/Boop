import { webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";
import { createContext } from "react";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void
}

export function getBrowserPreferredTheme() {
    const res = window.matchMedia('(prefers-color-scheme: dark)');
    return res.matches ? webDarkTheme : webLightTheme;
}

export const ThemeProvider = createContext<ThemeContextValue>({theme: getBrowserPreferredTheme(), setTheme: () => {}});