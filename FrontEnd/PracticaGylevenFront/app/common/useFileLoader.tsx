import { useCallback, useEffect, useMemo, useRef } from "react";
import ApiHelper from "~/common/ApiHelper";
import { useSocket } from "~/common/useSocket";
import { subscribeMediaTreeUpdates } from "~/media/mediaUpdates";

interface CachedEntry {
    promise: Promise<{ blob: Blob; contentType: string | null }>;
    abort: AbortController;
}

/**
 * Hook que ofrece descarga de blobs con cache y reacciona a eventos `media` del socket.
 */
export function useFileLoader() {
    const cacheRef = useRef<Map<string, CachedEntry>>(new Map());
    const socketHost = new URL(ApiHelper.API_URL).host;
    const { ready, subscribe } = useSocket("/ws/media-updates/", socketHost);

    /**
     * Aborta peticiones y vacía la caché de blobs.
     */
    const clearCache = useCallback(() => {
        cacheRef.current.forEach(({ abort }) => abort.abort());
        cacheRef.current.clear();
    }, []);

    /**
     * Recupera un archivo (o la promesa cacheada) y guarda el `AbortController` asociado.
     */
    const getFile = useCallback((url: string) => {
        const cached = cacheRef.current.get(url);
        if (cached) {
            return cached.promise;
        }
        const controller = new AbortController();
        const promise = fetch(url, {
            credentials: "include",
            signal: controller.signal,
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.blob().then((blob) => ({
                blob,
                contentType: response.headers.get("Content-Type"),
            }));
        });
        cacheRef.current.set(url, { promise, abort: controller });
        return promise;
    }, []);

    /**
     * Responde a mensajes WebSocket `refresh` invalidando el cache cuando afecta a `media`.
     */
    const handleSocket = useCallback(
        (data: unknown) => {
            if (typeof data !== "object" || data === null) {
                return;
            }
            const payload = data as { action?: string; resource?: string };
            if (
                payload.action === "refresh" &&
                (!payload.resource || payload.resource === "media")
            ) {
                clearCache();
            }
        },
        [clearCache],
    );

    useEffect(() => {
        const unsubscribeSocket = subscribe(handleSocket);
        return () => unsubscribeSocket();
    }, [handleSocket, subscribe]);

    useEffect(() => {
        if (!ready) {
            const unsubscribe = subscribeMediaTreeUpdates(() => {
                clearCache();
            });
            return unsubscribe;
        }
        return () => undefined;
    }, [clearCache, ready]);

    return useMemo(
        () => ({
            getFile,
            clearCache,
        }),
        [clearCache, getFile],
    );
}
