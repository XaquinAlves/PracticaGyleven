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
import { type InvoiceProps, fetchInvoices } from "./InvoicesModel";
import { ErrorMessages } from "~/common/messageCatalog";
import { useSocket } from "~/common/useSocket";
import { subscribeMediaTreeUpdates } from "~/media/mediaUpdates";// reuse broadcast fallback

interface InvoicesContextValue {
    invoices: InvoiceProps[];
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
}

const InvoicesContext = createContext<InvoicesContextValue | undefined>(
    undefined,
);

export function InvoicesProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [invoices, setInvoices] = useState<InvoiceProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const cacheRef = useRef<InvoiceProps[] | null>(null);
    const { ready, subscribe } = useSocket("/ws/media-updates/");

    const loadInvoices = useCallback(
        async (options?: { force?: boolean }) => {
            const force = options?.force ?? false;
            if (!force && cacheRef.current) {
                setInvoices(cacheRef.current);
                setLoading(false);
                setError("");
                return cacheRef.current;
            }
            setLoading(true);
            setError("");
            try {
                const fetched = await fetchInvoices();
                cacheRef.current = fetched;
                setInvoices(fetched);
                return fetched;
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : ErrorMessages.invoicesFetch,
                );
                setInvoices([]);
                cacheRef.current = null;
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const loadInvoicesRef = useRef(loadInvoices);

    useEffect(() => {
        loadInvoicesRef.current = loadInvoices;
    }, [loadInvoices]);

    useEffect(() => {
        const unsubscribe = subscribe((data) => {
            if (typeof data !== "object" || data === null) {
                return;
            }
            const payload = data as { action?: string; resource?: string };
            if (payload.action !== "refresh") {
                return;
            }
            if (!payload.resource || payload.resource === "media" || payload.resource === "invoices") {
                void loadInvoicesRef.current?.({ force: true });
            }
        });
        return unsubscribe;
    }, [subscribe]);

    useEffect(() => {
        if (ready) {
            return () => undefined;
        }
        const unsubscribe = subscribeMediaTreeUpdates(() => {
            if (loading) {
                return;
            }
            void loadInvoicesRef.current?.({ force: true });
        });
        return unsubscribe;
    }, [ready, loading]);

    useEffect(() => {
        void loadInvoices();
    }, [loadInvoices]);

    const refresh = useCallback(async () => {
        await loadInvoices({ force: true });
    }, [loadInvoices]);

    const value = useMemo(
        () => ({
            invoices,
            loading,
            error,
            refresh,
        }),
        [invoices, loading, error, refresh],
    );

    return (
        <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>
    );
}

export function useInvoices() {
    const context = useContext(InvoicesContext);
    if (!context) {
        throw new Error("useInvoices must be used within an InvoicesProvider");
    }
    return context;
}
