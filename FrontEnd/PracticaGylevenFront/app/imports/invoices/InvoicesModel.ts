import ApiHelper from "~/common/ApiHelper";
export interface InvoiceProps {
    name: string;
    page_count: number;
    invoice_number: string;
    invoice_date: string;
    total: number;
    extracted_at: string
}

export interface InvoiceTableProps {
    invoices: Array<InvoiceProps>;
}

export default class InvoicesModel {
    static invoices: InvoiceTableProps["invoices"];

    static fetchInvoices = async () => {
        try {
            const response = await fetch(
                ApiHelper.API_URL + "/registros/imports/facturas/list/",
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                },
            );
            if (response.ok) {
                const data = await response.json();
                this.invoices = data;
            } else {
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error de red al obtener la lista de facturas");
            throw err;
        }
    }
}
