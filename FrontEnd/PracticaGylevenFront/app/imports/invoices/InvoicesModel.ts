import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";

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

export async function fetchInvoices() {
    const response = await fetch(
        ApiHelper.API_URL + "/registros/imports/facturas/list/",
        {
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        },
    );
    if (!response.ok) {
        throw new Error(response.statusText || ErrorMessages.invoicesFetch);
    }
    return (await response.json()) as InvoiceProps[];
}
