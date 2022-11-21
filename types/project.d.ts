import { ChildProcess } from "child_process";
import * as express from "express"
/**
 * 
 * */
declare global {
    type Project = {
        path: string;
        config?: BoopConfig;
        name: string;
        route: string;
        router?: express.Router;
        hostProcess?: ChildProcess;
        port: number;
        repositoryURL: string;
        lastEvent: WebhookEvent;
        flow?: FlowSteps;
        isInstalling: boolean;
    }
}

export { }