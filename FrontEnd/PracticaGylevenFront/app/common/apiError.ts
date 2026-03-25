/**
 * Estructura unificada usada por los handlers al parsear errores de API.
 */
export interface ApiErrorPayload {
    status: number;
    detail: string;
    code?: string;
    errors?: Record<string, string[]>;
}

/**
 * Extrae un mensaje legible recorriendo cadenas, arrays u objetos anidados.
 */
function flattenApiMessage(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        const flattened = value
            .map((entry) => flattenApiMessage(entry))
            .filter((entry): entry is string => Boolean(entry));
        return flattened.length ? flattened.join(" ") : undefined;
    }
    if (value && typeof value === "object") {
        const message = formatApiObject(value as Record<string, unknown>);
        if (message) {
            return message;
        }
        for (const entry of Object.values(value)) {
            const flattened = flattenApiMessage(entry);
            if (flattened) {
                return flattened;
            }
        }
    }
    return undefined;
}

/**
 * Devuelve la propiedad `message` cuando está presente en un objeto.
 */
function formatApiObject(value: Record<string, unknown>) {
    const message =
        typeof value.message === "string" ? value.message : undefined;
    if (message) {
        return message
    }
    return undefined;
}

/**
 * Normaliza cualquier error HTTP en un payload controlado para mostrar en la UI.
 * @param response - Response que no fue OK.
 */
export async function parseApiError(
    response: Response,
): Promise<ApiErrorPayload> {
    try {
        const payload = await response.clone().json();
        const errorsMessage = flattenApiMessage(payload.errors);
        const detail =
            errorsMessage ||
            flattenApiMessage(payload.detail) ||
            (typeof payload.message === "string"
                ? payload.message
                : undefined) ||
            response.statusText ||
            "Error del servidor";
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
