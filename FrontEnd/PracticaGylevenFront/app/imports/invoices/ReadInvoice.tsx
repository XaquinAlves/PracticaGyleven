import { useState } from "react";
import ApiHelper from "~/common/ApiHelper";
import ErrorAlert from "~/common/ErrorAlert";

interface ReadInvoicesProps {
    onUploadSuccess?: () => void;
}

export default function ReadInvoices({
    onUploadSuccess,
}: ReadInvoicesProps) {
    const [files, setFiles] = useState<FileList | null>(null);
    const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
        "idle",
    );
    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFiles(event.target.files);
        setMessage("");
        setErrorMessage("");
    };

    const upload = async () => {
        if (!files?.length) {
            setMessage("");
            setErrorMessage("Selecciona al menos un archivo.");
            setStatus("error");
            return;
        }

        const form = new FormData();
        Array.from(files).forEach((file) => form.append("pdfs", file));

        setStatus("sending");
        setMessage("");
        setErrorMessage("");
        try {
            await ApiHelper.ensureCSRF();
            const response = await fetch(
                ApiHelper.API_URL + "/registros/imports/facturas",
                {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": ApiHelper.CSRF,
                    },
                    body: form,
                    credentials: "include",
                },
            );
            if (!response.ok) {
                throw new Error(`La subida devolvió ${response.status}`);
            }
            setStatus("done");
            setFiles(null);
            setMessage("Subida completada.");
            onUploadSuccess?.();
        } catch (error) {
            console.error(error);
            setStatus("error");
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Hubo un error inesperado al subir las facturas.",
            );
        }
    };

    const handleRetry = () => {
        void upload();
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
                {message && status !== "error" && (
                    <p className="text-success mt-3" aria-live="polite">
                        {message}
                    </p>
                )}
                {errorMessage && (
                    <div className="mt-3">
                        <ErrorAlert message={errorMessage} onRetry={handleRetry} />
                    </div>
                )}
            </div>
        </div>
    );
}
