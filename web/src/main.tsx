import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from "react-router";
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import './index.css'
import { FrontPage } from './pages/front/index.tsx';
import { ProjectPage } from './pages/project/index.tsx';
import { BoopAPI } from './api/api.ts';
import Stack from './components/stack/index.tsx';

if (import.meta.env.DEV) {
    BoopAPI.setOrigin("http://localhost:8004");
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <FluentProvider theme={webDarkTheme}>
            <div
                style={{
                    width: "100vw",
                    height: "100vh"
                }}
            >
                <Stack
                    horizontalAlign="center"
                    horizontalFill
                    verticalFill
                >
                    <Stack gap={16} style={{ maxWidth: "75vw" }} horizontalFill verticalFill>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/" Component={FrontPage}/>
                                <Route path="/:projectId" Component={ProjectPage}/>
                            </Routes>
                        </BrowserRouter>
                    </Stack>
                </Stack>
            </div>
        </FluentProvider>
    </StrictMode>
)
