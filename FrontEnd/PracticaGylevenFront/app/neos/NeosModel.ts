import Cookies from "js-cookie";
import type { ChangeEvent, SetStateAction } from "react";

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
    static page: number = 0;
    static neos?: NeosResponse;

    static handlePageChange = async (
        event: ChangeEvent<HTMLInputElement, HTMLInputElement>,
        setCargando: {
            (value: SetStateAction<boolean>): void;
            (arg0: boolean): void;
        },
    ) => {
        this.page = parseInt(event.target.value);
        setCargando(true);
    };

    static fetchNeos = async (page: number) => {
        try {
            const response = await fetch(
                "http://localhost:8000/registros/neos/" + page,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                },
            );
            if (response.ok) {
                const data = await response.json();
                this.neos = data;
            } else {
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
                "http://localhost:8000/registros/neos/save/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": Cookies.get("csrftoken") || "",
                    },
                    credentials: "include",
                    body: JSON.stringify(neos),
                },
            );
            if (response.ok) {
                alert("Datos guardados correctamente.");
            } else {
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error al guardar los datos.");
        }
    };
}
