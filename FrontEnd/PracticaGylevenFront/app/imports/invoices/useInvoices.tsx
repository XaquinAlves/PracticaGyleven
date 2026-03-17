import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { type InvoiceProps, fetchInvoices } from "./InvoicesModel";
import { ErrorMessages } from "~/common/messageCatalog";

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

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const fetched = await fetchInvoices();
            setInvoices(fetched);
        } catch (err) {
            setError(err instanceof Error ? err.message : ErrorMessages.invoicesFetch);
            setInvoices([]);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadInvoices();
    }, [loadInvoices]);

    const refresh = useCallback(async () => {
        await loadInvoices();
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
