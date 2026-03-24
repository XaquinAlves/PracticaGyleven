import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MessageHandler = (data: unknown) => void;

interface UseSocketResult {
    ready: boolean;
    subscribe: (handler: MessageHandler) => () => void;
}

const canUseWindow = typeof window !== "undefined";

function buildWebSocketUrl(path: string, hostOverride?: string) {
    if (!canUseWindow) {
        return "";
    }
    const host = hostOverride ?? window.location.host;
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${host}${path}`;
}

export function useSocket(path: string, hostOverride?: string): UseSocketResult {
    const [ready, setReady] = useState(false);
    const handlersRef = useRef<MessageHandler[]>([]);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | undefined>(undefined);
    const url = useMemo(() => buildWebSocketUrl(path, hostOverride), [
        path,
        hostOverride,
    ]);

    const dispatch = useCallback((data: unknown) => {
        handlersRef.current.forEach((handler) => handler(data));
    }, []);

    const connect = useCallback(() => {
        if (!canUseWindow || !url) {
            return;
        }
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.addEventListener("open", () => {
            setReady(true);
        });

        ws.addEventListener("message", (event) => {
            try {
                const parsed = JSON.parse(event.data);
                dispatch(parsed);
            } catch (err) {
                console.error("useSocket: invalid message payload", err);
            }
        });

        ws.addEventListener("close", () => {
            setReady(false);
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }
            reconnectTimerRef.current = window.setTimeout(() => {
                connect();
            }, 1000);
        });

        ws.addEventListener("error", () => {
            setReady(false);
            ws.close();
        });
    }, [dispatch, url]);

    useEffect(() => {
        if (!canUseWindow || !url) {
            return () => undefined;
        }
        connect();
        return () => {
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }
            socketRef.current?.close();
        };
    }, [connect, url]);

    const subscribe = useCallback((handler: MessageHandler) => {
        handlersRef.current.push(handler);
        return () => {
            handlersRef.current = handlersRef.current.filter(
                (entry) => entry !== handler,
            );
        };
    }, []);

    return { ready, subscribe };
}
