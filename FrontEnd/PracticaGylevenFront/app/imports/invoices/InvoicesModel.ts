import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { parseApiError } from "~/common/apiError";
// Este servicio respeta el formato documentado en app/common/apiErrorFormat.md

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
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.invoicesFetch);
    }
    return (await response.json()) as InvoiceProps[];
}
