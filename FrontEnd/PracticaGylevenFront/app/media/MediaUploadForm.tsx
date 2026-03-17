import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { type DirectoryProps } from "./MediaModel";
import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { useMedia } from "./useMedia";
import { publishMediaTreeUpdate } from "./mediaUpdates";

interface MediaUploadFormProps {
    onUploadSuccess?: () => void;
    onChange: () => void;
}

function isDirectory(
    entry: DirectoryProps | { type: string },
): entry is DirectoryProps {
    return entry.type === "directory";
}

function buildDirectoryPaths(root?: DirectoryProps): string[] {
    if (!root) return [""];

    const paths = new Set<string>();
    paths.add("");

    const collect = (node: DirectoryProps, basePath: string) => {
        const children = (node.children ?? []).filter(isDirectory);
        for (const child of children) {
            const childPath = basePath
                ? `${basePath}/${child.name}`
                : child.name;
            paths.add(childPath);
            collect(child, childPath);
        }
    };

    collect(root, "");
    return Array.from(paths);
}

export default function MediaUploadForm({
    onUploadSuccess,
    onChange,
}: MediaUploadFormProps) {
    const [files, setFiles] = useState<FileList | null>(null);
    const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
        "idle",
    );
    const [selectedPath, setSelectedPath] = useState("");
    const [newDirectory, setNewDirectory] = useState("");
    const [message, setMessage] = useState<string>("");
    const [dirError, setDirError] = useState("");

    const { directories } = useMedia();
    const basePaths = useMemo(
        () => buildDirectoryPaths(directories),
        [directories],
    );
    const availablePaths = useMemo(() => {
        const set = new Set(basePaths);
        if (selectedPath && !set.has(selectedPath)) {
            set.add(selectedPath);
        }
        return Array.from(set);
    }, [basePaths, selectedPath]);

    useEffect(() => {
        if (!directories) {
            return;
        }
        const paths = buildDirectoryPaths(directories);
        if (selectedPath && !paths.includes(selectedPath)) {
            setSelectedPath("");
        }
    }, [directories]);

    const selectedLabel = selectedPath ? `/${selectedPath}` : "/";

    const handleCreateDirectory = () => {
        const trimmed = newDirectory.trim();
        if (!trimmed) return;

        const sanitized = trimmed.replace(/[\\/]+/g, "-");
        const createdPath = selectedPath
            ? `${selectedPath}/${sanitized}`
            : sanitized;
        if (createdPath.length > 100) {
            setDirError(ErrorMessages.directoryNameTooLong);
            return;
        }
        if (availablePaths.includes(createdPath)) {
            setDirError(ErrorMessages.directoryAlreadyExists);
            return;
        }
        setDirError("");
        setSelectedPath(createdPath);
        setNewDirectory("");
        onChange();
        setMessage(ErrorMessages.directoryCreated(createdPath));
    };

    const upload = async () => {
        setMessage("");
        if (!files?.length) {
            setMessage(ErrorMessages.filesRequired);
            return;
        }

        const form = new FormData();
        Array.from(files).forEach((file) => form.append("files", file));
        form.append("target_dir", selectedPath);

        setStatus("sending");
        setMessage("");
        try {
            const response = await fetch(
                ApiHelper.API_URL + "/registros/media/upload/",
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
                throw new Error(ErrorMessages.uploadError);
            }

            const saved = await response.json();
            setStatus("done");
            setFiles(null);
            setMessage(ErrorMessages.uploadSuccess(saved.length, selectedLabel));
            publishMediaTreeUpdate();

            onUploadSuccess?.();
        } catch (error) {
            console.error(error);
            setStatus("error");
            setMessage(ErrorMessages.uploadError);
        }
    };

    const handleFolderChange = (event: {
        target: { value: SetStateAction<string> };
    }) => {
        setSelectedPath(event.target.value);
        setMessage("");
        onChange();
    };

    const handleFileChange = (event: {
        target: { files: SetStateAction<FileList | null> };
    }) => {
        setFiles(event.target.files);
        setMessage("");
        onChange();
    };

    return (
        <div className="card mt-5 ms-5">
            <h2 className="card-header text-center">Subir a MEDIA</h2>
            <div className="card-body">
                <div className="mb-3">
                    <label className="form-label">Seleccionar carpeta</label>
                    <select
                        className="form-select"
                        value={selectedPath}
                        onChange={handleFolderChange}
                    >
                        {availablePaths.map((path) => (
                            <option key={path} value={path}>
                                {path === "" ? "/" : `/${path}`}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="input-group mb-3">
                    <div className="d-flex flex-column gap-2">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Nueva carpeta"
                            value={newDirectory}
                            onChange={(event) =>
                                setNewDirectory(event.target.value)
                            }
                        />
                        {dirError && (
                            <p className="text-danger small mb-0">{dirError}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={handleCreateDirectory}
                    >
                        Crear subcarpeta
                    </button>
                </div>
                <p className="small text-muted">
                    Carpeta activa: <strong>{selectedLabel}</strong>
                </p>
                <div className="mb-3">
                    <label className="form-label">Archivos</label>
                    <input
                        type="file"
                        className="form-control"
                        multiple
                        onChange={handleFileChange}
                    />
                </div>
                <button
                    className="btn btn-primary"
                    onClick={upload}
                    disabled={status === "sending" || !files?.length}
                >
                    {status === "sending" ? "Subiendo..." : "Subir archivos"}
                </button>
                {message && (
                    <p
                        className={`mt-3 ${
                            status === "error" ? "text-danger" : "text-success"
                        }`}
                    >
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

