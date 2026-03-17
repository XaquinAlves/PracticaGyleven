export interface ApiErrorPayload {
    status: number;
    detail: string;
    code?: string;
    errors?: Record<string, string[]>;
}

export async function parseApiError(response: Response): Promise<ApiErrorPayload> {
    try {
        const payload = await response.clone().json();
        const detail =
            typeof payload.detail === "string"
                ? payload.detail
                : response.statusText || "Error del servidor";
        return {
            status: response.status,
            detail,
            code:
                typeof payload.code === "string"
                    ? payload.code
                    : response.statusText,
            errors:
                payload.errors &&
                typeof payload.errors === "object" &&
                !Array.isArray(payload.errors)
                    ? payload.errors
                    : undefined,
        };
    } catch {
        return {
            status: response.status,
            detail: response.statusText || "Error del servidor",
        };
    }
}
