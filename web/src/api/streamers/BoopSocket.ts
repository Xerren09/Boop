import { Observable, Subject } from "rxjs";

export class BoopSocket<TMessageType = unknown> {
    private _reconnectId: number = -1;
    private _reconnectAttemptScaler: number = 0;
    private _message: Subject<TMessageType> = new Subject<TMessageType>();
    private _url: URL;
    private _socket?: WebSocket = undefined;

    get url() {
        return this._url;
    }

    get socket() {
        return this._socket;
    }

    get message() {
        return this._message as Observable<TMessageType>;
    }

    get readyState() {
        return this._socket?.readyState ?? 3;
    }

    constructor(url: string | URL) {
        if (typeof url === "string") {
            if (URL.canParse(url) == false) {
                this.dispose();
                throw new Error("Passed invalid URL.");
            }
            this._url = new URL(url);
        }
        else {
            this._url = url;
        }
        this.connect(url);
    }

    private onOpen = () => {
        this._reconnectAttemptScaler = 0;
    }

    private onClose = (evt: CloseEvent) => {
        if (evt.reason !== "CLIENT_DISPOSE") {
            this.attemptReconnect();
        }
    }

    private onError = (err: Event) => {
        console.error("BoopSocket error", this._url, err);
    }

    private onMessage = (msg: MessageEvent) => {
        try {
            const data = JSON.parse(msg.data);
            this._message.next(data as TMessageType);
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                console.error("Unknown message received in socket:", this.url, msg.data);
            }
            else {
                console.error(error);
            }
        }
    }

    private attemptReconnect = () => {
        const base = 1000 * 2 ** this._reconnectAttemptScaler;
        const delay = base + getJitter();
        this._reconnectId = setTimeout(() => {
            this._reconnectId = -1;
            if (this._reconnectAttemptScaler < 5) {
                this._reconnectAttemptScaler++;
            }
            this.connect(this._url);
        }, delay);
    }

    private connect(url: string | URL) {
        this._socket = new WebSocket(url);
        this._socket.addEventListener("open", this.onOpen);
        this._socket.addEventListener("close", this.onClose);
        this._socket.addEventListener("error", this.onError);
        this._socket.addEventListener("message", this.onMessage);
    }

    dispose() {
        if (this._reconnectId != -1) {
            clearTimeout(this._reconnectId);
        }
        this._socket?.close(1000, "CLIENT_DISPOSE");
        this._socket?.removeEventListener("open", this.onOpen);
        this._socket?.removeEventListener("close", this.onClose);
        this._socket?.removeEventListener("error", this.onError);
        this._socket?.removeEventListener("message", this.onMessage);
        this._message?.complete();
    }
}


function getJitter(): number {
    return Math.round(Math.random() * 1000);
}