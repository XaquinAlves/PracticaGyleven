import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSocket } from "~/common/useSocket";
import { subscribeMediaTreeUpdates } from "~/media/mediaUpdates";

interface CachedEntry {
    promise: Promise<{ blob: Blob; contentType: string | null }>;
    abort: AbortController;
}

export function useFileLoader() {
    const cacheRef = useRef<Map<string, CachedEntry>>(new Map());
    const { ready, subscribe } = useSocket("/ws/media-updates/");

    const clearCache = useCallback(() => {
        cacheRef.current.forEach(({ abort }) => abort.abort());
        cacheRef.current.clear();
    }, []);

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
