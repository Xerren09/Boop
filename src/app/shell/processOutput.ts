import { MAX_TERMINAL_HISTORY } from "../constants.js";

export type ProcessOutputLine = {
    stream: "stdout" | "stderr",
    line: string
};

export class ProcessOutput {
    private _output: ProcessOutputLine[] = [];
    public get output(): ProcessOutputLine[] {
        return [...this._output];
    }

    /**
     * Adds a new line to the history.
     * 
     * If the number of entries exceeds {@link MAX_TERMINAL_HISTORY}, new entries will drop the oldest one.
     * @param channel 
     * @param line 
     */
    public addLine(channel: 'stdout' | 'stderr', line: string) {
        if (this._output.length >= MAX_TERMINAL_HISTORY) {
            this._output.shift();
        }
        this._output.push({ stream: channel, line });
    }

    public clear() {
        this._output = [];
    }

    public asString(): string {
        let text = "";
        for (let index = 0; index < this._output.length; index++) {
            const element = this._output[index];
            text += `\n${element?.line ?? ""}`;
        }
        return text;
    }
}