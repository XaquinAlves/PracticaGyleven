const CHANNEL_NAME = "media-tree-updates";
const STORAGE_KEY = "media-tree-update-marker";
const canUseWindow = typeof window !== "undefined";

export type MediaUpdateHandler = () => void;

/**
 * Se subscribe a actualizaciones del canal `media-tree-updates` y devuelve una función de cleanup.
 * Usa BroadcastChannel cuando está disponible o storage events como fallback.
 * @param handler - callback que se ejecuta cuando otro tab u otro emisor publica un refresh.
 * @returns función para eliminar los listeners.
 */
export function subscribeMediaTreeUpdates(handler: MediaUpdateHandler) {
    if (typeof BroadcastChannel === "function") {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.addEventListener("message", handler);
        return () => {
            channel.removeEventListener("message", handler);
            channel.close();
        };
    }

    if (!canUseWindow) {
        return () => undefined;
    }

    const storageHandler = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            handler();
        }
    };

    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
}

/**
 * Publica un evento de invalidación del árbol `media-tree` para otras pestañas.
 * Prioriza BroadcastChannel y usa localStorage como fallback para que el evento viaje.
 */
export function publishMediaTreeUpdate() {
    if (typeof BroadcastChannel === "function") {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ timestamp: Date.now() });
        channel.close();
        return;
    }

    if (!canUseWindow) {
        return;
    }

    if (typeof window !== "undefined") {
        const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(STORAGE_KEY, token);
    }
}
