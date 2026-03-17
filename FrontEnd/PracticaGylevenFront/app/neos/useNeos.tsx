import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { type NeosResponse, fetchNeos, saveNeos } from "./NeosModel";

interface NeosContextValue {
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

    const loadNeos = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const fetched = await fetchNeos(page);
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
        await loadNeos();
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
