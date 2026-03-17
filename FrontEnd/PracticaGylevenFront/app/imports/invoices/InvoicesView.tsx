import Sidebar from "~/common/Sidebar";
import ReadInvoices from "./ReadInvoice";
import { useEffect, useState } from "react";
import InvoicesTable from "./Invoice";
import InvoicesModel from "./InvoicesModel";
import ErrorAlert from "~/common/ErrorAlert";

export default function InvoicesView() {
    const [cargando, setCargando] = useState<boolean>(
        InvoicesModel.invoices === undefined,
    );

    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (!cargando) {
            return;
        }

        const loadInvoices = async () => {
            setError("");
            try {
                await InvoicesModel.fetchInvoices();
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setCargando(false);
            }
        };

        void loadInvoices();
    }, [cargando]);

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <ReadInvoices setCargando={setCargando} />
                <div className="col-12 col-md-12 mt-5">
                    {cargando ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : InvoicesModel.invoices ? (
                        <InvoicesTable invoices={InvoicesModel.invoices} />
                    ) : error ? (
                        <ErrorAlert
                            message={error}
                            onRetry={() => setCargando(true)}
                        />
                    ) : (
                        <p className="text-muted">
                            No se han cargado los datos todavía.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
