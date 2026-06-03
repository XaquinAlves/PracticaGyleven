import Cookies from "js-cookie";

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";;

/**
 * Utilidades para acceder a la API (CSRF, URL y cabeceras JSON).
 */
export default class ApiHelper {
    static API_URL = DEFAULT_API_URL;
    static CSRF = Cookies.get("csrftoken") || "";

    /**
     * Fuerza la carga de un token CSRF desde el backend y lo guarda en la clase.
     */
    static async refreshCSRF() {
        const response = await fetch(`${ApiHelper.API_URL}/api/csrf/`, {
            credentials: "include",
        });
        if (!response.ok) {
            throw new Error("Unable to refresh CSRF token");
        }

        ApiHelper.CSRF = response.headers.get("x-csrftoken") || "";
        return ApiHelper.CSRF;
    }

    /**
     * Garantiza que exista CSRF antes de enviar formularios (carga uno nuevo si hace falta).
     */
    static async ensureCSRF() {
        if (!ApiHelper.CSRF) {
            return ApiHelper.refreshCSRF();
        }
        return ApiHelper.CSRF;
    }

    /**
     * Construye cabeceras `Content-Type` JSON e incluye CSRF si está disponible.
     */
    static getJsonHeaders(includeCSRF = true) {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (includeCSRF && ApiHelper.CSRF) {
            headers["X-CSRFToken"] = ApiHelper.CSRF;
        }

        return headers;
    }
}
