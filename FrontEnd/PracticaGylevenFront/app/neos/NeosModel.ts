import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { parseApiError } from "~/common/apiError";

// TODO: cualquier respuesta de error proveniente de estos endpoints adopta { status, detail, code, errors } (documentado en app/common/apiErrorFormat.md).

/**
 * Representa un Near Earth Object (NEO) con los datos que consume la UI.
 */
export interface NeoItem {
    id: number;
    name: string;
    estimated_diameter_km_min: number;
    estimated_diameter_km_max: number;
    is_potentially_hazardous: boolean;
}

/**
 * Payload devuelto por el endpoint `/registros/neos/:page`.
 */
export interface NeosResponse {
    neos: NeoItem[];
}

/**
 * Props necesarias para renderizar la tabla y manejar el guardado.
 */
export interface NeosTableProps {
    neos: NeoItem[];
    onSave: () => Promise<void>;
    saving: boolean;
}

/**
 * Descarga la lista de NEOs paginada y lanza en caso de error.
 */
export async function fetchNeos(page: number) {
    const response = await fetch(`${ApiHelper.API_URL}/registros/neos/${page}`, {
        headers: ApiHelper.getJsonHeaders(false),
        credentials: "include",
    });
    if (!response.ok) {
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.genericFetch);
    }
    return (await response.json()) as NeosResponse;
}

/**
 * Guarda los datos de NEOs en el backend (POST /registros/neos/save/).
 * @throws Error si el servidor responde con status distinto de OK.
 */
export async function saveNeos(neos: NeosResponse) {
    const response = await fetch(ApiHelper.API_URL + "/registros/neos/save/", {
        method: "POST",
        headers: {
            ...ApiHelper.getJsonHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(neos),
    });
    if (!response.ok) {
        const apiError = await parseApiError(response);
        throw new Error(apiError.detail || ErrorMessages.saveNeos);
    }
}

/**
 * Intenta extraer `detail` de la respuesta cuando el backend falla.
 */
async function parseDetail(response: Response) {
    try {
        const payload = await response.clone().json();
        if (payload && typeof payload.detail === "string") {
            return payload.detail;
        }
    } catch (error) {
        console.error("Failed to parse error detail", error);
    }
    return response.statusText;
}
