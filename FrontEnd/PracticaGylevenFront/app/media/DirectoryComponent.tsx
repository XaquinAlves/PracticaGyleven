import type { DirectoryProps } from "./MediaModel";
import FileComponent from "./FileComponent";
import { isDirectory, toggleImportantFile } from "./MediaModel";
import { useCallback, useMemo, useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import { ErrorMessages } from "~/common/messageCatalog";
import { useMedia } from "./useMedia";
import { publishMediaTreeUpdate } from "./mediaUpdates";

interface DirectoryComponentProps {
    directory?: DirectoryProps;
}

function sanitizeId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export default function DirectoryComponent({
    directory,
}: DirectoryComponentProps) {
    const {
        directories,
        importantFiles,
        refresh,
        toggleDirectory,
        isDirectoryExpanded,
    } = useMedia();
    const resolvedDirectory = directory ?? directories;
    const [toggleError, setToggleError] = useState("");

    const importantPaths = useMemo(() => {
        const next = new Set<string>();
        importantFiles.forEach((file) => next.add(file.relative_path));
        return next;
    }, [importantFiles]);

    const handleToggleImportant = useCallback(
        async (relativePath: string, currentlyImportant: boolean) => {
            setToggleError("");
            try {
                await toggleImportantFile(relativePath, !currentlyImportant);
                await refresh();
                publishMediaTreeUpdate();
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : ErrorMessages.toggleImportant;
                console.error(message);
                setToggleError(message);
            }
        },
        [refresh],
    );

    if (!resolvedDirectory) {
        return null;
    }

    const directoryPath =
        resolvedDirectory.relativePath || resolvedDirectory.name;
    const collapseId = `collapse-${sanitizeId(directoryPath)}`;
    const expanded = isDirectoryExpanded(directoryPath);
    const handleToggleDirectory = useCallback(() => {
        toggleDirectory(directoryPath);
    }, [directoryPath, toggleDirectory]);

    return (
        <ul className="list-group list-group-flush">
            <li className="list-group-item">
                <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleToggleDirectory}
                    aria-expanded={expanded}
                    aria-controls={collapseId}
                >
                    <i className="fa-solid fa-folder"></i>
                    {resolvedDirectory.name}
                    <i className="fa-solid fa-arrow-turn-down"></i>
                </button>
                <div
                    className={`collapse${expanded ? " show" : ""}`}
                    id={collapseId}
                >
                    <ul className="list-group list-group-flush">
                        {(resolvedDirectory.children || []).map((element) => {
                            if (isDirectory(element)) {
                                return (
                                    <li className="list-group-item">
                                        <DirectoryComponent
                                            key={
                                                element.relativePath ||
                                                element.name
                                            }
                                            directory={element}
                                        />
                                    </li>
                                );
                            } else {
                                return (
                                    <FileComponent
                                        key={element.relativePath}
                                        file={element}
                                        important={importantPaths.has(
                                            element.relativePath,
                                        )}
                                        onToggleImportant={
                                            handleToggleImportant
                                        }
                                    />
                                );
                            }
                        })}
                    </ul>
                </div>
            </li>
            {toggleError ? (
                <li className="list-group-item">
                    <ErrorAlert
                        message={toggleError}
                        onRetry={() => {
                            setToggleError("");
                            void refresh();
                        }}
                    />
                </li>
            ) : null}
        </ul>
    );
}
