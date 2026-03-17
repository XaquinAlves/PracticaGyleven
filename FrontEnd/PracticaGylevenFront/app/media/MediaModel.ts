import ApiHelper from  "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";

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
    const response = await fetch(ApiHelper.API_URL + "/registros/media-tree/", {
        headers: ApiHelper.getJsonHeaders(false),
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(response.statusText || ErrorMessages.mediaError);
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
        throw new Error(ErrorMessages.genericFetch);
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
        throw new Error(response.statusText || ErrorMessages.genericFetch);
    }
    const data = await response.json();
    return data.tree_version ?? "";
}

export async function toggleImportantFile(
    relativePath: string,
    important: boolean,
) {
    const response = await fetch(
        ApiHelper.API_URL + "/registros/media/important-files/toggle/",
        {
            method: "POST",
            headers: ApiHelper.getJsonHeaders(true),
            credentials: "include",
            body: JSON.stringify({
                relative_path: relativePath,
                important: important,
            }),
        },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            data?.detail || response.statusText || ErrorMessages.toggleImportant;
        throw new Error(message);
    }

    return data;
}
