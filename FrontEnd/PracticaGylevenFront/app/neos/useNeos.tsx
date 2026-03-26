import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { type NeosResponse, fetchNeos, saveNeos } from "./NeosModel";
import ApiHelper from "~/common/ApiHelper";
import { useSocket } from "~/common/useSocket";

const NEOS_UPDATE_CHANNEL = "neos-updates";
const canUseWindow = typeof window !== "undefined";
const MAX_CACHED_PAGES = 10;
const NEOS_UPDATE_EVENT = "neos-update-local";

/** Calcula un hash SHA-256 (o fallback) para detectar cambios en los datos. */
async function computeNeosHash(payload: NeosResponse) {
    const serialized = JSON.stringify(payload);
    if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
        const bytes = new TextEncoder().encode(serialized);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
        hash = (hash * 31 + serialized.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
}

export interface NeosContextValue {
    neos: NeosResponse | null;
    loading: boolean;
    error: string;
    page: number;
    setPage: (value: number) => void;
    refresh: () => Promise<void>;
    saveToDatabase: () => Promise<void>;
}

const NeosContext = createContext<NeosContextValue | undefined>(undefined);

export const MIN_NEOS_PAGE = 0;
export const MAX_NEOS_PAGE = 100;

/** Limita la página solicitada al rango permitido y trunca decimales. */
function clampPage(value: number) {
    if (Number.isNaN(value)) {
        return MIN_NEOS_PAGE;
    }
    const truncated = Math.trunc(value);
    return Math.min(MAX_NEOS_PAGE, Math.max(MIN_NEOS_PAGE, truncated));
}

/** 
 * Suscribe a `BroadcastChannel` o `localStorage` para recibir eventos locales de neos.
 */
function subscribeNeosUpdates(handler: () => void) {
    if (typeof BroadcastChannel === "function") {
        const channel = new BroadcastChannel(NEOS_UPDATE_CHANNEL);
        channel.addEventListener("message", handler);
        return () => {
            channel.removeEventListener("message", handler);
            channel.close();
        };
    }

    if (!canUseWindow) {
        return () => undefined;
    }

    const listener = (event: StorageEvent | Event) => {
        if (event instanceof StorageEvent) {
            if (event.key === NEOS_UPDATE_CHANNEL) {
                handler();
            }
        } else {
            handler();
        }
    };
    window.addEventListener("storage", (event) => listener(event));
    window.addEventListener(NEOS_UPDATE_EVENT, listener);
    return () => {
        window.removeEventListener("storage", listener);
        window.removeEventListener(NEOS_UPDATE_EVENT, listener);
    };
}


/**
 * Provider que expone los NEOS actuales, la página activa y métodos para recargar/guardar.
 */
export function NeosProvider({
    children,
    initialPage = 0,
}: {
    children: ReactNode;
    initialPage?: number;
}) {
    const [neos, setNeos] = useState<NeosResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPageState] = useState(() => clampPage(initialPage));
    const cachedPagesRef = useRef<Map<number, NeosResponse>>(new Map());
    const pageZeroHashRef = useRef<string>("");

    /**
     * Descarga la página activa, mantiene caché de máximo 10 páginas y recalcula hashes.
     */
    const loadNeos = useCallback(
        async (options?: { force?: boolean }) => {
            setLoading(true);
            setError("");
            try {
                const force = options?.force ?? false;
                if (!force && page !== MIN_NEOS_PAGE) {
                    const cached = cachedPagesRef.current.get(page);
                    if (cached) {
                        setNeos(cached);
                        setLoading(false);
                        return;
                    }
                }
                const fetched = await fetchNeos(page);
                if (page === MIN_NEOS_PAGE) {
                    const computedHash = await computeNeosHash(fetched);
                    if (
                        pageZeroHashRef.current &&
                        computedHash !== pageZeroHashRef.current
                    ) {
                        cachedPagesRef.current.clear();
                    }
                    pageZeroHashRef.current = computedHash;
                }
            while (cachedPagesRef.current.size >= MAX_CACHED_PAGES) {
                const iterator = cachedPagesRef.current.keys();
                const firstKey = iterator.next().value;
                if (firstKey === undefined) {
                    break;
                }
                cachedPagesRef.current.delete(firstKey);
            }
            cachedPagesRef.current.set(page, fetched);
                setNeos(fetched);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Error al cargar los NEOs",
                );
                setNeos(null);
            } finally {
                setLoading(false);
            }
        },
        [page],
    );

    const loadNeosRef = useRef(loadNeos);
    const [neosHash, setNeosHash] = useState("");
    const neosHashRef = useRef(neosHash);
    const neosHost = new URL(ApiHelper.API_URL).host;
    const { subscribe: subscribeSocket } = useSocket("/ws/media-updates/", neosHost);

    /**
     * Mantiene el ref apuntando a la versión más reciente de `loadNeos` para invocaciones externas.
     */
    useEffect(() => {
        loadNeosRef.current = loadNeos;
    }, [loadNeos]);

    /**
     * Escucha eventos locales (BroadcastChannel / storage) que piden refrescar los datos.
     */
    useEffect(() => {
        const unsubscribe = subscribeNeosUpdates(() => {
            void loadNeosRef.current?.({ force: true });
        });
        return unsubscribe;
    }, []);

    /**
     * Guarda el hash calculado para evitar recargas cuando no hay cambios reales.
     */
    useEffect(() => {
        neosHashRef.current = neosHash;
    }, [neosHash]);

    /**
     * Se suscribe al socket para forzar recargas cuando el backend indica que cambió el hash.
     */
    useEffect(() => {
        const unsubscribe = subscribeSocket((data) => {
            if (typeof data === "object" && data !== null) {
                const payload = data as {
                    action?: string;
                    resource?: string;
                    hash?: string;
                };
                if (payload.action === "refresh" && payload.resource === "neos") {
                    if (payload.hash && payload.hash === neosHashRef.current) {
                        return;
                    }
                    if (payload.hash) {
                        setNeosHash(payload.hash);
                    }
                    void loadNeosRef.current?.({ force: true });
                }
            }
        });
        return unsubscribe;
    }, [subscribeSocket]);

    /**
     * Dispara la carga inicial de la página actual cuando el provider se monta.
     */
    useEffect(() => {
        void loadNeos();
    }, [loadNeos]);

    /** Fuerza una recarga completa ignorando cache local. */
    const refresh = useCallback(async () => {
        await loadNeos({ force: true });
    }, [loadNeos]);

    /** Envía los datos actuales al endpoint `/registros/neos/save/`. */
    const saveToDatabase = useCallback(async () => {
        if (!neos) {
            return;
        }
        await saveNeos(neos);
    }, [neos]);

    const setPage = useCallback((value: number) => {
        setPageState(clampPage(value));
    }, []);

    const value = useMemo(
        () => ({
            neos,
            loading,
            error,
            page,
            setPage,
            refresh,
            saveToDatabase,
        }),
        [neos, loading, error, page, refresh, saveToDatabase],
    );

    return (
        <NeosContext.Provider value={value}>{children}</NeosContext.Provider>
    );
}

export function useNeos() {
    const context = useContext(NeosContext);
    if (!context) {
        throw new Error("useNeos must be used within a NeosProvider");
    }
    return context;
}
