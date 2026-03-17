import ApiHelper from  "~/common/ApiHelper";

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

export function isDirectory(
    entry: FileProps | DirectoryProps | { type: string },
): entry is DirectoryProps {
    return entry.type === "directory";
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

export async function fetchMediaTree() {
    const response = await fetch(ApiHelper.API_URL + "registros/media-tree/", {
        headers: ApiHelper.getJsonHeaders(false),
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(response.statusText || "No se pudo cargar el árbol de media");
    }
    const data: ApiEntry[] = await response.json();
    return data.map(normalizeEntry);
}

export async function fetchImportantFiles() {
    const response = await fetch(
        ApiHelper.API_URL + "/registros/media/important-files/",
        {
            headers: ApiHelper.getJsonHeaders(false),
            credentials: "include",
        },
    );
    if (!response.ok) {
        throw new Error("No se pudieron cargar los archivos importantes");
    }
    const data: ImportantFile[] = await response.json();
    return data.filter((file) => file.is_important);
}


export async function fetchMediaTreeVersion() {
    const response = await fetch(
        ApiHelper.API_URL + "/registros/media-tree/version/",
        {
            headers: ApiHelper.getJsonHeaders(false),
            credentials: "include",
        },
    );
    if (!response.ok) {
        throw new Error(response.statusText || "No se pudo verificar versión del árbol");
    }
    const data = await response.json();
    return data.tree_version ?? "";
}
