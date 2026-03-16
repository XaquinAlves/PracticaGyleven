import Sidebar from "~/common/Sidebar";
import { useEffect, useState } from "react";
import MediaModdel from "./MediaModel";
import DirectoryComponent from "./DirectoryComponent";
import MediaUploadForm from "./MediaUploadForm";

export default function MediaView() {
    const [cargando, setCargando] = useState<boolean>(
        MediaModdel.directories === undefined,
    );
    const [importantPaths, setImportantPaths] = useState<Set<string>>(
        () => new Set(),
    );

    if (cargando) {
        MediaModdel.fetchDirectories().then(() => {
            setCargando(false);
        });
    }

    useEffect(() => {
        if (cargando) {
            return;
        }

        const loadImportantPaths = async () => {
            try {
                const response = await MediaModdel.loadImportantPaths();
                console.log(MediaModdel.important_files);
                MediaModdel.important_files.forEach(file => {
                    if (file.is_important) {
                        importantPaths.add(file.relative_path)
                    }
                });
                console.log(importantPaths);
            } catch (err) {
                console.error(err);
                alert(
                    "No se pudieron cargar los archivos marcados como importantes",
                );
            }
        };

        void loadImportantPaths();
    }, [cargando]);

    const handleToggleImportant = async (
        relativePath: string,
        currentlyImportant: boolean,
    ) => {
        try {
            const response = await fetch(
                "http://localhost:8000/registros/media/important-files/toggle/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
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
                    ) : (
                        <DirectoryComponent
                            directory={MediaModdel.directories}
                            importantPaths={importantPaths}
                            onToggleImportant={handleToggleImportant}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
