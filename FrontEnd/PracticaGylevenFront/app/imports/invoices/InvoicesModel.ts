import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { parseApiError } from "~/common/apiError";
// Este servicio respeta el formato documentado en app/common/apiErrorFormat.md

/**
 * Datos que se muestran por fila en la tabla de facturas.
 */
export interface InvoiceProps {
    name: string;
    page_count: number;
    invoice_number: string;
    invoice_date: string;
    total: number;
    extracted_at: string;
}

/**
 * Props del componente que renderiza la tabla completa.
 */
export interface InvoiceTableProps {
    invoices: Array<InvoiceProps>;
}

/**
 * Descarga el listado completo de facturas desde `/registros/imports/facturas/list/`.
 * @throws Error con el detalle recuperado por `parseApiError` cuando la petición falla.
 */
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
