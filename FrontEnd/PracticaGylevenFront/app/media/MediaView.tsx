import Sidebar from "~/common/Sidebar";
import { useEffect, useState } from "react";
import MediaModdel from "./MediaModel";
import DirectoryComponent from "./DirectoryComponent";
import MediaUploadForm from "./MediaUploadForm";
import MediaModel from "./MediaModel";
import ApiHelper from "~/common/ApiHelper";

export default function MediaView() {
    const [importantPaths, setImportantPaths] = useState<Set<string>>(
        new Set(),
    );

    const [cargando, setCargando] = useState<boolean>(
        MediaModdel.directories === undefined || importantPaths.size === 0,
    );

    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (cargando) {
            try {
                MediaModdel.fetchDirectories().then(() => {
                    MediaModel.loadImportantPaths().then(() => {
                        let importantSet = new Set<string>();
                        MediaModdel.important_files.forEach((file) => {
                            if (file.is_important) {
                                importantSet.add(file.relative_path);
                            }
                        });
                        setImportantPaths(importantSet);

                    });
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setCargando(false);
            }
        }
    }, [cargando]);

    const handleToggleImportant = async (
        relativePath: string,
        currentlyImportant: boolean,
    ) => {
        try {
            const response = await fetch(
                ApiHelper.API_URL + "/registros/media/important-files/toggle/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": ApiHelper.CSRF,
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        relative_path: relativePath,
                        important: !currentlyImportant,
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(response.statusText);
            }
            MediaModdel.forceFetch = true;
            setImportantPaths((previous) => {
                const next = new Set(previous);
                if (currentlyImportant) {
                    next.delete(relativePath);
                } else {
                    next.add(relativePath);
                }
                return next;
            });
        } catch (err) {
            console.error(err);
            alert(
                "No se pudo actualizar el estado de importancia del archivo.",
            );
        }
    };

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <div className="col-12">
                    <MediaUploadForm
                        onUploadSuccess={() => setCargando(true)}
                    />
                </div>
                <div className="col-12 col-md-12 mt-5">
                    {cargando ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : MediaModdel.directories ? (
                        <DirectoryComponent
                            directory={MediaModdel.directories}
                            importantPaths={importantPaths}
                            onToggleImportant={handleToggleImportant}
                        />
                    ) : error ? (
                        <div className="alert alert-danger">
                            {error}
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setCargando(true)}
                            >
                                Reintentar
                            </button>
                        </div>
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
