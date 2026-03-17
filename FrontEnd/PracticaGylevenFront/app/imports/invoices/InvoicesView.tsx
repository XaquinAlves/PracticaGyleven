import Sidebar from "~/common/Sidebar";
import ReadInvoices from "./ReadInvoice";
import InvoicesTable from "./Invoice";
import ErrorAlert from "~/common/ErrorAlert";
import { ErrorMessages } from "~/common/messageCatalog";
import { InvoicesProvider, useInvoices } from "./useInvoices";

export default function InvoicesView() {
    return (
        <InvoicesProvider>
            <InvoicesViewContent />
        </InvoicesProvider>
    );
}

export function InvoicesViewContent() {
    const { invoices, loading, error, refresh } = useInvoices();
    const handleRefresh = () => {
        void refresh();
    };

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <ReadInvoices onUploadSuccess={handleRefresh} />
                <div className="col-12 col-md-12 mt-5">
                    {loading ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : error ? (
                        <ErrorAlert message={error} onRetry={handleRefresh} />
                    ) : invoices.length ? (
                        <InvoicesTable invoices={invoices} />
                    ) : (
                        <p className="text-muted">
                            {ErrorMessages.invoicesEmpty}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
