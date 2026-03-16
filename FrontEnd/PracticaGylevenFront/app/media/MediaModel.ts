export interface FileProps {
    name: string;
    type: "file";
    size: number;
    relativePath: string;
}

export interface DirectoryProps {
    name: string;
    type: "directory";
    relativePath: string;
    children: Array<FileProps | DirectoryProps>;
}

export interface ImportantFile {
    relative_path: string;
    is_important: boolean;
    marked_at: string;
    marked_by: string;
}

export interface ImportantTableProps {
    important_files: ImportantFile[];
}

export default class MediaModel {
    static directories: DirectoryProps;
    static important_files: ImportantFile[];

    static fetchDirectories = async () => {
        try {
            const response = await fetch(
                "http://localhost:8000/registros/media-tree/",
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                },
            );

            if (response.ok) {
                const data = await response.json();
                MediaModel.directories = {
                    name: "media",
                    type: "directory",
                    relativePath: "",
                    children: (data || []).map((entry: ApiEntry) =>
                        normalizeEntry(entry),
                    ),
                };
            } else {
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error de red al obtener los directorios");
        }
    };

    static loadImportantPaths = async () => {
        try {
            const response = await fetch(
                "http://localhost:8000/registros/media/important-files/",
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                },
            );
            console.log('esperando respuseta')
            if (response.ok) {
                const data = await response.json();
                console.log('data:', data)
                let filtered_files = data.filter(
                    (file: ImportantFile) => {
                        return file.is_important;
                    },
                );
                console.log('filtrado:', filtered_files)
                MediaModel.important_files = filtered_files;
            } else {
                console.log(response.statusText)
                throw new Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            console.log(this.important_files);
            alert(
                "No se pudieron cargar los archivos marcados como importantes",
            );
        }
    };
}

interface ApiBaseEntry {
    name: string;
    type: "file" | "directory";
    relative_path: string;
}

interface ApiFileEntry extends ApiBaseEntry {
    type: "file";
    size: number;
}

interface ApiDirectoryEntry extends ApiBaseEntry {
    type: "directory";
    children: ApiEntry[];
}

type ApiEntry = ApiFileEntry | ApiDirectoryEntry;

function normalizeEntry(entry: ApiEntry): FileProps | DirectoryProps {
    if (entry.type === "directory") {
        return {
            name: entry.name,
            type: entry.type,
            relativePath: entry.relative_path,
            children: (entry.children || []).map(normalizeEntry),
        };
    }
    return {
        name: entry.name,
        type: entry.type,
        size: entry.size,
        relativePath: entry.relative_path,
    };
}

export function isDirectory(
    entry: FileProps | DirectoryProps,
): entry is DirectoryProps {
    return entry.type === "directory";
}
