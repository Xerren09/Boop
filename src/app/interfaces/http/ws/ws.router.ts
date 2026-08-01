import { WebsocketRouter } from "./WebsocketRouter.js";
import Manager from "../../../project/manager.js";
import { InstallStreamer } from "./install.streamer.js";
import { ProjectStreamer } from "./project.streamer.js";

export const wsRouter = new WebsocketRouter();

wsRouter.ws("/boop/api/projects/:projectName", (ws, params) => {
    const project = Manager.projects.find(item => item.name === params.path["projectName"]);
    if (project) {
        const withServiceProcess = (params.query.get("withProcess") ?? false) == "true";
        const streamer = new ProjectStreamer(ws, project, withServiceProcess);
        ws.once("close", () => {
            streamer[Symbol.dispose]();
        });
    }
    else {
        ws.close();
    }
});

wsRouter.ws("/boop/api/projects/:projectName/installer", (ws, params) => {
    const project = Manager.projects.find(item => item.name === params.path["projectName"]);
    if (project) {
        const streamer = new InstallStreamer(ws, project)
        ws.once("close", () => {
            streamer[Symbol.dispose]();
        });
    }
    else {
        ws.close();
    }
});

