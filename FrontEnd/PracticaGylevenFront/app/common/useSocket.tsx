import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MessageHandler = (data: unknown) => void;

interface UseSocketResult {
    ready: boolean;
    subscribe: (handler: MessageHandler) => () => void;
}

const canUseWindow = typeof window !== "undefined";

/**
 * Construye la URL completa del WebSocket para el backend.
 * @param path Ruta del socket (ejemplo: "/ws/media-updates/").
 * @param hostOverride Host del backend cuando no coincide con window.location.host.
 */
function buildWebSocketUrl(path: string, hostOverride?: string) {
    if (!canUseWindow) {
        return "";
    }
    const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    const fallbackHost =
        hostOverride ??
        (apiUrl
            ? (() => {
                try {
                    return new URL(apiUrl).host;
                } catch {
                    return window.location.host;
                }
            })()
            : window.location.host);
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${fallbackHost}${path}`;
}

/**
 * Hook que abre y mantiene una conexión WebSocket con reconexión automática.
 * @param path Ruta del socket relativo.
 * @param hostOverride Host personalizado (usualmente el host del backend).
 * @returns Objeto `{ ready, subscribe }` donde `ready` indica estado conectado y `subscribe` permite registrar handlers JSON.
 */
export function useSocket(
    path: string,
    hostOverride?: string,
): UseSocketResult {
    const [ready, setReady] = useState(false);
    const handlersRef = useRef<MessageHandler[]>([]);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | undefined>(undefined);
    const url = useMemo(
        () => buildWebSocketUrl(path, hostOverride),
        [path, hostOverride],
    );

    const dispatch = useCallback((data: unknown) => {
        handlersRef.current.forEach((handler) => handler(data));
    }, []);

    /**
     * Crea la conexión WebSocket, se reintenta tras cerrar y actualiza `ready`.
     */
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

    /**
     * Establece el efecto que abre la conexión y se cierra al desmontar.
     */
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
