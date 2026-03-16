import type { FileProps } from "./MediaModel";

interface FileComponentProps {
    file: FileProps;
    important: boolean;
    onToggleImportant: (relativePath: string, currentlyImportant: boolean) => void;
}

export default function FileComponent({
    file,
    important,
    onToggleImportant,
}: FileComponentProps) {
    return (
        <li
            className={`list-group-item d-flex justify-content-between align-items-center ${important ? "list-group-item-success" :  "list-group-item-secondary" }`}
        >
            <div>
                <i className="fa-solid fa-file me-2"></i>
                {file.name}
                <small className="text-muted ms-2">Peso: {file.size}</small>
            </div>
            <button
                type="button"
                className={`btn btn-sm ${
                    important ? "btn-warning" : "btn-success"
                }`}
                onClick={() => onToggleImportant(file.relativePath, important)}
            >
                {important ? "Desmarcar importante" : "Marcar importante"}
            </button>
        </li>
    );
}
