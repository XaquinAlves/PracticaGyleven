import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Cookies from "js-cookie";

interface ReadInvoicesProps {
    setCargando: Dispatch<SetStateAction<boolean>>;
}

export default function ReadInvoices({ setCargando }: ReadInvoicesProps) {
    const [files, setFiles] = useState<FileList | null>(null);
    const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
        "idle",
    );

    const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFiles(event.target.files);
    };

    const upload = async () => {
        if (!files?.length) return;
        const form = new FormData();
        Array.from(files).forEach((file) => form.append("pdfs", file));

        setStatus("sending");
        try {
            const response = await fetch(
                "http://localhost:8000/registros/imports/facturas",
                {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": Cookies.get("csrftoken") || "",
                    },
                    body: form,
                    credentials: "include",
                },
            );
            if (!response.ok) {
                throw new Error("La subida devolvió " + response.status);
            }
            setStatus("done");
            setFiles(null);
            setCargando(true);
        } catch (error) {
            console.error(error);
            setStatus("error");
        }
    };

    return (
        <div className="card mt-5 ms-5 w-auto h-25">
            <h2 className="card-header text-center">Importar Factura PDF</h2>
            <div className="card-body">
                <input
                    type="file"
                    className="form-control"
                    accept="application/pdf"
                    multiple
                    onChange={handleFiles}
                />
                <button
                    className="btn btn-primary mt-3"
                    onClick={upload}
                    disabled={!files?.length || status === "sending"}
                >
                    {status === "sending" ? "Subiendo..." : "Subir PDFs"}
                </button>
                {status === "done" && (
                    <p className="text-success">Subida completada.</p>
                )}
                {status === "error" && (
                    <p className="text-danger">Hubo un error al subir.</p>
                )}
            </div>
        </div>
    );
}
