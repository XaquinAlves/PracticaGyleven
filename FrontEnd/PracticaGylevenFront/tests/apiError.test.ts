import { describe, expect, it } from "vitest";
import { parseApiError } from "../app/common/apiError";

describe("parseApiError", () => {
    it("shows the required field name when the backend returns errors with param", async () => {
        const payload = {
            detail: "Este campo es requerido.",
            errors: [
                {
                    message: "Este campo es requerido.",
                    code: "required",
                    param: "username",
                },
            ],
        };
        const response = new Response(JSON.stringify(payload), {
            status: 400,
            statusText: "Bad Request",
        });
        const parsed = await parseApiError(response);
        expect(parsed.detail).toBe("Este campo es requerido. (campo: username)");
    });
});
