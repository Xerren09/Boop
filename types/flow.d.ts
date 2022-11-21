import { ChildProcess } from "child_process"

/**
 * 
 * */
declare global {
    type FlowSteps = {
        startTime: number;
        clone?: ExecResult;
        build?: ExecResult[];
        host?: string;
        final?: ExecResult;
    }

    type ExecResult = {
        command: string;
        output: string[];
        error: string[];
        exitCode: number;
    }
}

export { }