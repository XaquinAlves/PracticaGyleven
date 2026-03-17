import Sidebar from "~/common/Sidebar";
import NeosTable from "./Neo";
import { useEffect, useState, type ChangeEvent } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import { ErrorMessages } from "~/common/messageCatalog";
import {
    type NeosContextValue,
    NeosProvider,
    useNeos,
    MIN_NEOS_PAGE,
    MAX_NEOS_PAGE,
} from "./useNeos";
import { getNeosViewPhase } from "./neosViewState";

export default function NeosView() {
    return (
        <NeosProvider>
            <NeosViewContent />
        </NeosProvider>
    );
}

type UseNeosHook = () => NeosContextValue;

export function NeosViewContent({
    useNeosHook = useNeos,
}: {
    useNeosHook?: UseNeosHook;
}) {
    const {
        neos,
        loading,
        error,
        page,
        setPage,
        refresh,
        saveToDatabase,
    } = useNeosHook();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [pageInput, setPageInput] = useState(page.toString());
    const [pageError, setPageError] = useState("");

    const handlePageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const rawValue = event.target.value;
        setPageInput(rawValue);

        if (!rawValue.trim()) {
            setPageError(ErrorMessages.invalidPageNumber);
            return;
        }

        if (!/^-?\\d+$/.test(rawValue)) {
            setPageError(ErrorMessages.integersOnly);
            return;
        }

        const numericValue = Number(rawValue);

        if (numericValue < MIN_NEOS_PAGE || numericValue > MAX_NEOS_PAGE) {
            setPageError(ErrorMessages.pageRange(MIN_NEOS_PAGE, MAX_NEOS_PAGE));
            return;
        }

        setPageError("");
        setPage(numericValue);
    };

    useEffect(() => {
        setPageInput(page.toString());
    }, [page]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError("");
        setSuccessMessage("");
        try {
            await saveToDatabase();
            setSuccessMessage("Datos guardados correctamente.");
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : ErrorMessages.saveNeos,
            );
        } finally {
            setSaving(false);
        }
    };

    const phase = getNeosViewPhase({ loading, error, neos });
    let content;

    if (phase === "loading") {
        content = (
            <div className="spinner-border text-center" role="status">
                <span className="visually-hidden">Cargando...</span>
            </div>
        );
    } else if (phase === "error") {
        content = <ErrorAlert message={error} onRetry={refresh} />;
    } else if (phase === "data" && neos) {
        content = (
            <>
                <NeosTable
                    neos={neos.neos}
                    onSave={handleSave}
                    saving={saving}
                />
                {successMessage && <p className="text-success">{successMessage}</p>}
                {saveError && (
                    <ErrorAlert
                        className="mt-3"
                        message={saveError}
                        onRetry={handleSave}
                    />
                )}
            </>
        );
    } else {
        content = (
            <p className="text-muted">{ErrorMessages.emptyNeos}</p>
        );
    }

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center mt-5 col-8 col-lg-10">
                <div>
                    <div className="form-group mb-3 col-6 col-lg-2">
                        <label htmlFor="page">
                            Número de página (entre {MIN_NEOS_PAGE} y {" "}
                            {MAX_NEOS_PAGE}):
                        </label>
                        <input
                            type="number"
                            className="form-control"
                            id="page"
                            name="page"
                            min={MIN_NEOS_PAGE}
                            max={MAX_NEOS_PAGE}
                            value={pageInput}
                            onChange={handlePageChange}
                            inputMode="numeric"
                        />
                        {pageError && (
                            <div className="text-danger small mt-1">
                                {pageError}
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-12 col-md-12 mt-5">{content}</div>
            </div>
        </div>
    );
}
