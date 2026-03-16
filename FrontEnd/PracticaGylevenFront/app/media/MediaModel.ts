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

export default class MediaModdel {
    static directories: DirectoryProps;

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
                MediaModdel.directories = {
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
