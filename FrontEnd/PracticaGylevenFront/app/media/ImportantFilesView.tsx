import { useEffect, useState } from "react";
import MediaModel, {
    type ImportantFile,
    type ImportantTableProps,
} from "./MediaModel";
import Sidebar from "~/common/Sidebar";
import ErrorAlert from "~/common/ErrorAlert";

export default function ImportantFilesView() {
    const [cargando, setCargando] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (!cargando) {
            return;
        }

        const loadImportantFiles = async () => {
            setError("");
            try {
                await MediaModel.loadImportantPaths({
                    force: MediaModel.forceFetch,
                });
                MediaModel.forceFetch = false;
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setCargando(false);
            }
        };

        void loadImportantFiles();
    }, [cargando]);

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <div className="col-12 col-md-12 mt-5">
                    {cargando ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : error ? (
                        <ErrorAlert
                            message={error}
                            onRetry={() => setCargando(true)}
                            className="btn-sm"
                        />
                    ) : (
                        <ImportantFilesTable
                            important_files={MediaModel.important_files || []}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export function ImportantFile({
    relative_path,
    marked_at,
    marked_by,
}: ImportantFile) {
    return (
        <tr>
            <td>{relative_path}</td>
            <td>{marked_at}</td>
            <td>{marked_by}</td>
        </tr>
    );
}

export function ImportantFilesTable({ important_files }: ImportantTableProps) {
    if (important_files !== undefined) {
        return (
            <table className="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th>Ruta relativa</th>
                        <th>Marcado en</th>
                        <th>Marcado por</th>
                    </tr>
                </thead>
                <tbody>
                    {important_files.map((file) => {
                        return (
                            <ImportantFile
                                key={file.relative_path}
                                relative_path={file.relative_path}
                                marked_at={file.marked_at}
                                marked_by={file.marked_by}
                                is_important={true}
                            />
                        );
                    })}
                </tbody>
            </table>
        );
    } else {
        return <div className="alert">Carganddo</div>;
    }
}
