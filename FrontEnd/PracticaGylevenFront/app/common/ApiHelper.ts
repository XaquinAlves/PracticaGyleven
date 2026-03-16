import Cookies from "js-cookie";

const DEFAULT_API_URL = "http://localhost:8000";

export default class ApiHelper {
    static API_URL =
        (import.meta.env.VITE_API_URL as string | undefined) ?? DEFAULT_API_URL;
    static CSRF = Cookies.get("csrftoken") || "";

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

    static async ensureCSRF() {
        if (!ApiHelper.CSRF) {
            return ApiHelper.refreshCSRF();
        }
        return ApiHelper.CSRF;
    }

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
