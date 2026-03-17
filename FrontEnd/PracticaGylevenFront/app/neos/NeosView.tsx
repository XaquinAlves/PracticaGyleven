import Sidebar from "~/common/Sidebar";
import NeosTable from "./Neo";
import { useState, type ChangeEvent } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import {
    NeosProvider,
    useNeos,
    MIN_NEOS_PAGE,
    MAX_NEOS_PAGE,
} from "./useNeos";

export default function NeosView() {
    return (
        <NeosProvider>
            <NeosViewContent />
        </NeosProvider>
    );
}

function NeosViewContent() {
    const {
        neos,
        loading,
        error,
        page,
        setPage,
        refresh,
        saveToDatabase,
    } = useNeos();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const handlePageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value);
        const nextPage = Number.isNaN(value) || value < 0 ? 0 : value;
        setPage(nextPage);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError("");
        setSuccessMessage("");
        try {
            await saveToDatabase();
            setSuccessMessage("Datos guardados correctamente.");
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : "Error al guardar los datos.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center mt-5 col-8 col-lg-10">
                <div>
                    <div className="form-group mb-3 col-6 col-lg-2">
                        <label htmlFor="page">
                            Número de página (entre {MIN_NEOS_PAGE} y{" "}
                            {MAX_NEOS_PAGE}):
                        </label>
                        <input
                            type="number"
                            className="form-control"
                            id="page"
                            name="page"
                            min={MIN_NEOS_PAGE}
                            max={MAX_NEOS_PAGE}
                            value={page}
                            onChange={handlePageChange}
                            inputMode="numeric"
                        />
                    </div>
                </div>

                <div className="col-12 col-md-12 mt-5">
                    {loading ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : error ? (
                        <ErrorAlert message={error} onRetry={refresh} />
                    ) : neos ? (
                        <>
                            <NeosTable
                                neos={neos.neos}
                                onSave={handleSave}
                                saving={saving}
                            />
                            {successMessage && (
                                <p className="text-success">
                                    {successMessage}
                                </p>
                            )}
                            {saveError && (
                                <ErrorAlert
                                    className="mt-3"
                                    message={saveError}
                                    onRetry={handleSave}
                                />
                            )}
                        </>
                    ) : (
                        <p className="text-muted">
                            No se han cargado los datos todavía.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
