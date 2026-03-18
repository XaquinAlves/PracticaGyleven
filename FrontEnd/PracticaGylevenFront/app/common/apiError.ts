export interface ApiErrorPayload {
    status: number;
    detail: string;
    code?: string;
    errors?: Record<string, string[]>;
}

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

function formatApiObject(value: Record<string, unknown>) {
    const message =
        typeof value.message === "string" ? value.message : undefined;
    const param =
        typeof value.param === "string"
            ? value.param
            : typeof value.param === "object" && value.param
            ? String(value.param)
            : undefined;
    if (message) {
        return param ? `${message} (campo: ${param})` : message;
    }
    return undefined;
}

export async function parseApiError(response: Response): Promise<ApiErrorPayload> {
    try {
        const payload = await response.clone().json();
        const detail =
            flattenApiMessage(payload.detail) ||
            (typeof payload.message === "string"
                ? payload.message
                : undefined) ||
            flattenApiMessage(payload.errors) ||
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
