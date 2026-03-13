import type { DirectoryProps } from "./MediaModel";
import FileComponent from "./FileComponent";
import { isDirectory } from "./MediaModel";

interface DirectoryComponentProps {
    directory: DirectoryProps;
}

export default function DirectoryComponent({
    directory,
}: DirectoryComponentProps) {
    return (
        <ul className="list-group list-group-flush">
            <li className="list-group-item">
                <button
                    className="btn btn-primary"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target={"#"+directory.name}
                    aria-expanded="false"
                    aria-controls="collapseExample"
                >
                    <i className="fa-solid fa-folder"></i>
                    {directory.name}
                    <i className="fa-solid fa-arrow-turn-down"></i>
                </button>
                <div className="collapse" id={directory.name}>
                    <ul className="list-group list-group-flush">
                        {(directory.children || []).map((element) => {
                            if (isDirectory(element)) {
                                return (
                                    <li className="list-group-item">
                                        <DirectoryComponent
                                            key={element.name}
                                            directory={element}
                                        />
                                    </li>
                                );
                            } else {
                                return (
                                    <FileComponent
                                        key={element.name}
                                        file={element}
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
