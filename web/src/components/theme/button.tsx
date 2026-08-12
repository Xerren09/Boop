import { useContext } from "react";
import { ThemeProvider } from "./context";
import { ToggleButton, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { WeatherMoonFilled, WeatherSunnyRegular } from "@fluentui/react-icons";

export default function ThemeSwitchButton() {
    const { theme, setTheme } = useContext(ThemeProvider);
    
    const isLightTheme = theme == webLightTheme;

    return (
        <div>
            <ToggleButton
                appearance="subtle"
                checked={ !isLightTheme }
                onClick={() => { setTheme(isLightTheme ? webDarkTheme : webLightTheme) }}
                icon={ isLightTheme ? <WeatherSunnyRegular/> : <WeatherMoonFilled/> }
            >
            </ToggleButton>
        </div>
    );
}