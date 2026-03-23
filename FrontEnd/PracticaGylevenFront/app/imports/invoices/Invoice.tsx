import { memo } from "react";
import type { InvoiceProps, InvoiceTableProps } from "./InvoicesModel";

export const Invoice = memo(function Invoice({
    name,
    page_count,
    invoice_number,
    invoice_date,
    total,
    extracted_at,
}: InvoiceProps) {
    return (
        <tr>
            <td>{name}</td>
            <td>{page_count}</td>
            <td>{invoice_number}</td>
            <td>{invoice_date}</td>
            <td>{total}</td>
            <td>{extracted_at}</td>
        </tr>
    );
});

function InvoicesTableBase({ invoices }: InvoiceTableProps) {
    return (
        <table className="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Num Paginas</th>
                    <th>Num Factura</th>
                    <th>Fecha Factura</th>
                    <th>Total</th>
                    <th>Extraida en</th>
                </tr>
            </thead>
            <tbody>
                {invoices.map((invoice, index) => {
                    const rowKey =
                        invoice.invoice_number ??
                        invoice.name ??
                        invoice.extracted_at ??
                        `${index}`;
                    return (
                        <Invoice
                            key={rowKey}
                            name={invoice.name}
                            page_count={invoice.page_count}
                            invoice_number={invoice.invoice_number}
                            invoice_date={invoice.invoice_date}
                            total={invoice.total}
                            extracted_at={invoice.extracted_at}
                        />
                    );
                })}
            </tbody>
        </table>
    );
}

export default memo(InvoicesTableBase);
