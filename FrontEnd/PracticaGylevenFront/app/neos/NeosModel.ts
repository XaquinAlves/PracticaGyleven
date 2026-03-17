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
}

export default class NeosModel {
    static neos?: NeosResponse;
    static error = "";

    static fetchNeos = async (page: number) => {
        try {
            const response = await fetch(
                `${ApiHelper.API_URL}/registros/neos/${page}`,
                {
                    headers: ApiHelper.getJsonHeaders(false),
                    credentials: "include",
                },
            );
            if (response.ok) {
                const data = await response.json();
                this.neos = data;
            } else {
                NeosModel.error = response.statusText
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error de red al obtener los NEOs.");
        }
    };

    static handleSaveToDatabase = async (neos: NeosResponse) => {
        try {
            const response = await fetch(
                ApiHelper.API_URL + "/registros/neos/save/",
                {
                    method: "POST",
                    headers: {
                        ...ApiHelper.getJsonHeaders(),
                    },
                    credentials: "include",
                    body: JSON.stringify(neos),
                },
            );
            if (response.ok) {
                alert("Datos guardados correctamente.");
            } else {
                NeosModel.error = response.statusText;
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error al guardar los datos.");
        }
    };
}
