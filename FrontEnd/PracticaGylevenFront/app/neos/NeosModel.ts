import ApiHelper from "~/common/ApiHelper";

export interface NeoItem {
    id: number;
    name: string;
    estimated_diameter_km_min: number;
    estimated_diameter_km_max: number;
    is_potentially_hazardous: boolean;
}

export interface NeosResponse {
    neos: NeoItem[];
}

export interface NeosTableProps {
    neos: NeoItem[];
    onSave: () => Promise<void>;
    saving: boolean;
}

export async function fetchNeos(page: number) {
    const response = await fetch(`${ApiHelper.API_URL}/registros/neos/${page}`, {
        headers: ApiHelper.getJsonHeaders(false),
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(
            (await parseDetail(response)) || "Error al obtener los NEOs",
        );
    }
    return (await response.json()) as NeosResponse;
}

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
        throw new Error(
            (await parseDetail(response)) || "Error al guardar los NEOs",
        );
    }
}

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
