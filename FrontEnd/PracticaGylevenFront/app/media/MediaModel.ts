export interface FileProps {
    name: string;
    type: string;
    size: number;
}

export interface DirectoryProps {
    name: string;
    type: string;
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
                    children: data,
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

export function isDirectory(
    entry: FileProps | DirectoryProps,
): entry is DirectoryProps {
    return entry.type === "directory";
}
