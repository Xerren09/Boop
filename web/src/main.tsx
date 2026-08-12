import { lazy, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from "react-router";
import { FluentProvider, type Theme } from '@fluentui/react-components';
import './index.css'
import { BoopAPI } from './api/api.ts';
import Stack from './components/stack/index.tsx';
import { getBrowserPreferredTheme, ThemeProvider } from './components/theme/context.tsx';

if (import.meta.env.DEV) {
    BoopAPI.setOrigin("http://localhost:8004");
}

const FrontPage = lazy(() => import('./pages/front/index.tsx'));
const ProjectPage = lazy(() => import('./pages/project/index.tsx'));

// eslint-disable-next-line react-refresh/only-export-components
function App() {
    const [theme, setTheme] = useState<Theme>(getBrowserPreferredTheme);
    const value = { theme, setTheme };
    
    return (
        <ThemeProvider value={value}>
            <FluentProvider theme={theme}>
                <div
                    style={{
                        minHeight: "100vh"
                    }}
                >
                    <Stack
                        horizontalAlign="center"
                        horizontalFill
                        verticalFill
                    >
                        <Stack gap={16} id='mainContentContainer' horizontalFill verticalFill>
                            <BrowserRouter basename={`${import.meta.env.BASE_URL}`}>
                                <Routes>
                                    <Route path="/" Component={FrontPage}/>
                                    <Route path="/:projectId" Component={ProjectPage}/>
                                </Routes>
                            </BrowserRouter>
                        </Stack>
                    </Stack>
                </div>
            </FluentProvider>
        </ThemeProvider>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)
