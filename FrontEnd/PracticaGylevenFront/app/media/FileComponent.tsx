import { useState } from "react";
import type { FileProps } from "./MediaModel";
import ApiHelper from "~/common/ApiHelper";
import ErrorAlert from "~/common/ErrorAlert";
import { ErrorMessages } from "~/common/messageCatalog";

interface FileComponentProps {
    file: FileProps;
    important: boolean;
    onToggleImportant: (relativePath: string, currentlyImportant: boolean) => void;
}

const PREVIEWABLE_MIME_PREFIXES = ["image/", "text/"];
const PREVIEWABLE_MIME_EXACT = [
    "application/pdf",
    "application/json",
    "application/xml",
];

function canDisplayInline(contentType: string | null, fileName: string) {
    if (contentType) {
        if (
            PREVIEWABLE_MIME_PREFIXES.some((prefix) =>
                contentType.startsWith(prefix),
            )
        ) {
            return true;
        }
        if (PREVIEWABLE_MIME_EXACT.includes(contentType)) {
            return true;
        }
    }

    const ext = fileName.split(".").pop()?.toLowerCase();
    return ext
        ? ["pdf", "txt", "md", "csv", "json"].includes(ext)
        : false;
}

export default function FileComponent({
    file,
    important,
    onToggleImportant,
}: FileComponentProps) {
    const [isFetching, setIsFetching] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    const handleFetchFile = async () => {
        setDownloadError("");
        setIsFetching(true);
        try {
            const url = `${ApiHelper.API_URL}/registros/media/download/?path=${encodeURIComponent(
                file.relativePath,
            )}`;
            const response = await fetch(url, {
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            const blob = await response.blob();
            const contentType = response.headers.get("Content-Type");
            const objectUrl = URL.createObjectURL(blob);

            if (canDisplayInline(contentType, file.name)) {
                window.open(objectUrl, "_blank", "noopener");
            } else {
                const anchor = document.createElement("a");
                anchor.href = objectUrl;
                anchor.download = file.name;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
            }

            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
        } catch (err) {
            console.error(err);
            setDownloadError(ErrorMessages.downloadFallback);
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <li
            className={`list-group-item d-flex justify-content-between align-items-center ${important ? "list-group-item-success" : "list-group-item-secondary"}`}
        >
            <div>
                <i className="fa-solid fa-file me-2"></i>
                <span className="me-2">{file.name}</span>
                <small className="text-muted">Peso: {file.size}</small>
            </div>
            <div className="btn-group" role="group">
                <button
                    type="button"
                    className={`btn btn-sm me-2 ${
                        important ? "btn-warning" : "btn-outline-success"
                    }`}
                    onClick={() =>
                        onToggleImportant(file.relativePath, important)
                    }
                >
                    {important ? "Desmarcar importante" : "Marcar importante"}
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleFetchFile}
                    disabled={isFetching}
                >
                    {isFetching ? "Cargando..." : "Abrir/Descargar"}
                </button>
            </div>
            {downloadError ? (
                <div className="mt-2 w-100">
                    <ErrorAlert
                        message={downloadError}
                        onRetry={() => {
                            setDownloadError("");
                            void handleFetchFile();
                        }}
                    />
                </div>
            ) : null}
        </li>
    );
}
