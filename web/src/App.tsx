import React from 'react';
import { initializeIcons } from '@fluentui/react';
import { ProjectPage } from './pages/project/index';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { FrontPageComponent } from './pages/front/index';
import { BoopRoot } from './pages/root';
import { overrideHost } from './util';
initializeIcons();
//overrideHost("localhost:8004");

const router = createBrowserRouter([
    {
        path: "/*",
        Component: BoopRoot,
        children: [
            {
                index: true,
                Component: FrontPageComponent
            },
            {
                path: ":projectId",
                Component: ProjectPage,
            }
        ]
    },
], {
    basename: "/boop"
});

export const App: React.FunctionComponent = () => {
    return (
        <RouterProvider router={router}/>
    );
};
