import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { parseApiError } from "~/common/apiError";
// See app/common/apiErrorFormat.md for el esquema compartido { status, detail, code, errors } que valida parseApiError.

/**
 *
 * Interfaz que determina los atributos que debe tener un archivo
 * @param name nombre del archivo
 * @param type tipo, para diferenciar archivo/directorio, en este caso siempre "file"
 * @param syze tamaño del archivo en bits
 * @param relativePath ruta del archivo desde el directorio media como raíz
 */
export interface FileProps {
    name: string;
    type: "file";
    size: number;
    relativePath: string;
}
/**
 *
 * Interfaz que determina los atributos que debe tener una carpeta
 * @param name nombre de la carpeta
 * @param type tipo, para diferenciar archivo/directorio, en este caso siempre "directory"
 * @param relativePath ruta del directorio desde el directorio media como raíz
 * @param children archivos y directorios contenidos por la carpeta
 */
export interface DirectoryProps {
    name: string;
    type: "directory";
    relativePath: string;
    children: Array<FileProps | DirectoryProps>;
}
/**
 * Interfaz que determina los parámetros de un archivo que se guardan para marcarlo como importante, guardado en important_files.csv
 * @param relativePath ruta del archivo desde el directorio media como raíz
 * @param is_important true para archivo importante, si un archivo se desmarca se pone a false en lugar de borrarse el registro
 * @param marked_at última fecha en la que el archivo se marcó/desmarcó como importante
 * @param marked_by ultimo usuario en marcar/desmarcar el archivo
 */
export interface ImportantFile {
    relative_path: string;
    is_important: boolean;
    marked_at: string;
    marked_by: string;
}

export interface ImportantTableProps {
    important_files: ImportantFile[];
}
//Para comprobar si una entra es un directorio
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
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.mediaError);
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
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.genericFetch);
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
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.genericFetch);
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
        const apiError = await parseApiError(response);
        const message =
            apiError.detail ||
            response.statusText ||
            ErrorMessages.toggleImportant;
        throw new Error(message);
    }

    return data;
}
