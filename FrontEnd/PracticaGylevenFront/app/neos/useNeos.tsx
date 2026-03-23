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

function clampPage(value: number) {
    if (Number.isNaN(value)) {
        return MIN_NEOS_PAGE;
    }
    const truncated = Math.trunc(value);
    return Math.min(MAX_NEOS_PAGE, Math.max(MIN_NEOS_PAGE, truncated));
}

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

    const loadNeos = useCallback(async (options?: { force?: boolean }) => {
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
            cachedPagesRef.current.set(page, fetched);
            setNeos(fetched);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cargar los NEOs");
            setNeos(null);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        void loadNeos();
    }, [loadNeos]);

    const refresh = useCallback(async () => {
        await loadNeos({ force: true });
    }, [loadNeos]);

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
