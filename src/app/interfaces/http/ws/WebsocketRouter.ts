import type Stream from "node:stream";
import { type IncomingMessage } from "node:http";
import { type MatchFunction, match } from "path-to-regexp";
import { WebSocketServer, type WebSocket } from "ws";

type UpgradeHandlerFunc = (req: IncomingMessage, socket: Stream.Duplex, head: Buffer) => boolean
type RouteMatchFunction = MatchFunction<Partial<Record<string, string | string[]>>>;

// Inspired by https://websocket.org/guides/frameworks/express/#the-noserver-option-path-based-routing
export class WebsocketRouter {
    private wss: WebSocketServer;
    private routeHandlers: {match: RouteMatchFunction, handler: (ws: WebSocket, params: { path: Partial<Record<string, string | string[]>>, query: URLSearchParams }) => void}[] = [];
    private rawHandlers: UpgradeHandlerFunc[] = [];

    constructor() {
        this.wss = new WebSocketServer({ noServer: true });
    }

    ws(path: string, func: (ws: WebSocket, params: { path: Partial<Record<string, string | string[]>>, query: URLSearchParams }) => void) {
        this.routeHandlers.push({
            match: match(path),
            handler: func
        });
    }

    raw(handler: (req: IncomingMessage, socket: Stream.Duplex, head: Buffer) => boolean) {
        this.rawHandlers.push(handler);
    }

    handleUpgrade = (req: IncomingMessage, socket: Stream.Duplex, head: Buffer) => {
        let handled = false;
        for (const route of this.rawHandlers) {
            if (handled = route(req, socket, head)) {
                break;
            }
        }
        if (handled) {
            return true;
        }
        for (const route of this.routeHandlers) {
            const { pathname, searchParams } = new URL(req.url!, "http://localhost");
            const match = route.match(pathname);
            handled = match !== false;
            if (match === false) {
                continue;
            }
            else {
                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    route.handler(ws, {
                        path: match.params,
                        query: searchParams
                    });
                });
                break;
            }
        }
        return handled;
    }
}
