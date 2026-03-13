import Sidebar from "~/common/Sidebar";
import ReadInvoices from "./ReadInvoice";
import { useState } from "react";
import InvoicesTable from "./Invoice";
import InvoicesModel from "./InvoicesModel";

export default function InvoicesView() {
        const [cargando, setCargando] = useState<boolean>(
            InvoicesModel.invoices === undefined,
        );

        if (cargando) {
            InvoicesModel.fetchInvoices().then(() => {
                setCargando(false);
            });
        }

        return (
            <div className="row">
                <Sidebar />
                <div className="row justify-content-center col-9 col-lg-10">
                    <ReadInvoices setCargando={setCargando}/>
                    <div className="col-12 col-md-12 mt-5">
                        {cargando ? (
                            <div
                                className="spinner-border text-center"
                                role="status"
                            >
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        ) : (
                            <InvoicesTable invoices={InvoicesModel.invoices} />
                        )}
                    </div>
                </div>
            </div>
        );
}