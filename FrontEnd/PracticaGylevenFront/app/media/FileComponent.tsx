import type { FileProps } from "./MediaModel";

interface FileComponentProps {
    file: FileProps;
}

export default function FileComponent({ file }: FileComponentProps) {
    return (
        <li className="list-group-item list-group-item-secondary">
            <i className="fa-solid fa-file"></i>
            {file.name} Peso: {file.size}
        </li>
    );
}
