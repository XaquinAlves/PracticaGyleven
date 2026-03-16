import type { DirectoryProps } from "./MediaModel";
import FileComponent from "./FileComponent";
import { isDirectory } from "./MediaModel";

interface DirectoryComponentProps {
    directory: DirectoryProps;
    importantPaths: Set<string>;
    onToggleImportant: (relativePath: string, currentlyImportant: boolean) => void;
}

function sanitizeId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export default function DirectoryComponent({
    directory,
    importantPaths,
    onToggleImportant,
}: DirectoryComponentProps) {
    const collapseId = `collapse-${sanitizeId(
        directory.relativePath || directory.name,
    )}`;

    return (
        <ul className="list-group list-group-flush">
            <li className="list-group-item">
                <button
                    className="btn btn-primary"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target={"#" + collapseId}
                    aria-expanded="false"
                    aria-controls={collapseId}
                >
                    <i className="fa-solid fa-folder"></i>
                    {directory.name}
                    <i className="fa-solid fa-arrow-turn-down"></i>
                </button>
                <div className="collapse" id={collapseId}>
                    <ul className="list-group list-group-flush">
                        {(directory.children || []).map((element) => {
                            if (isDirectory(element)) {
                                return (
                                    <li className="list-group-item">
                                        <DirectoryComponent
                                            key={
                                                element.relativePath ||
                                                element.name
                                            }
                                            directory={element}
                                            importantPaths={importantPaths}
                                            onToggleImportant={onToggleImportant}
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
                                        onToggleImportant={onToggleImportant}
                                    />
                                );
                            }
                        })}
                    </ul>
                </div>
            </li>
        </ul>
    );
}
