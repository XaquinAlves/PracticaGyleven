import type React from "react";
import type { NavigateFunction } from "react-router";
import { getSession } from "~/routes/home";
import ApiHelper from "~/common/ApiHelper";
import { ErrorMessages } from "~/common/messageCatalog";
import { type ApiErrorPayload, parseApiError } from "~/common/apiError";

export const PASSWORD_RULES = [
    "mínimo 8 caracteres",
    "una letra mayúscula",
    "una letra minúscula",
    "un número",
    "un símbolo especial",
];

export function ensurePasswordStrength(password: string) {
    const strengthMessage = ErrorMessages.passwordStrength;
    if (password.length < 8) {
        throw new Error(strengthMessage);
    }
    if (!/[A-Z]/.test(password)) {
        throw new Error(strengthMessage);
    }
    if (!/[a-z]/.test(password)) {
        throw new Error(strengthMessage);
    }
    if (!/[0-9]/.test(password)) {
        throw new Error(strengthMessage);
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        throw new Error(strengthMessage);
    }
}

const sessionErrorMessages: Record<string, string> = {
    INVALID_JSON_PAYLOAD: ErrorMessages.sessionInvalidJson,
    CREDENTIALS_REQUIRED: ErrorMessages.sessionCredentialsRequired,
    INVALID_CREDENTIALS: ErrorMessages.invalidCredentials,
    AUTH_REQUIRED: ErrorMessages.sessionAuthRequired,
    PASSWORD_REQUIRED: ErrorMessages.sessionPasswordRequired,
    TOTP_SECRET_MISSING: ErrorMessages.sessionTotpSecretMissing,
};

function mapSessionApiError(payload: ApiErrorPayload, fallback: string) {
    if (!payload) {
        return fallback;
    }
    const mapped = payload.code ? sessionErrorMessages[payload.code] : undefined;
    return mapped || payload.detail || fallback;
}

async function throwSessionApiError(response: Response, fallback: string) {
    const payload = await parseApiError(response);
    throw new Error(mapSessionApiError(payload, fallback));
}

export async function whoami() {
    try {
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/auth/session",
            {
                headers: ApiHelper.getJsonHeaders(false),
                credentials: "include",
            },
        );
        if (response.ok) {
            const data = await response.json();
            const username = data.data.user.username;
            console.log("Iniciaste sesión como: " + username);
            return username;
        } else {
            console.log("No has iniciado sesión");
            return "";
        }
    } catch (err) {
        console.error(err);
        return "";
    }
}

export async function get_username() {
    try {
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/auth/session",
            {
                headers: ApiHelper.getJsonHeaders(false),
                credentials: "include",
            },
        );
        if (response.ok) {
            const data = await response.json();
            return data.data.user.username;
        } else {
            return "";
        }
    } catch (err) {
        console.error(err);
        return "";
    }
}

export async function changePass(
    event: React.FormEvent<HTMLFormElement>,
    oldPassword: string,
    newPassword: string,
    repeatPassword: string,
) {
    event.preventDefault();

    if (newPassword !== repeatPassword) {
        throw new Error(ErrorMessages.passwordMismatch);
    }

    ensurePasswordStrength(newPassword);
    {
        try {
            await ApiHelper.ensureCSRF();
            const response = await fetch(
                ApiHelper.API_URL +
                    "/_allauth/browser/v1/account/password/change",
                {
                    method: "POST",
                    headers: ApiHelper.getJsonHeaders(),
                    credentials: "include",
                    body: JSON.stringify({
                        current_password: oldPassword,
                        new_password: newPassword,
                    }),
                },
            );
            if (!response.ok) {
                await throwSessionApiError(
                    response,
                    ErrorMessages.passwordChangeError,
                );
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

export async function resetPass(
    event: React.FormEvent<HTMLFormElement>,
    password: string,
    repeatPassword: string,
    key: string,
) {
    event.preventDefault();
    if (password !== repeatPassword) {
        throw new Error(ErrorMessages.passwordMismatch);
    }

    ensurePasswordStrength(password);

    try {
        await ApiHelper.ensureCSRF();
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/auth/password/reset",
            {
                method: "POST",
                headers: ApiHelper.getJsonHeaders(),
                credentials: "include",
                body: JSON.stringify({
                    key: key,
                    password: password,
                }),
            },
        );
        if (response.status === 401) {
            window.location.assign("/login");
            return;
        }
        if (!response.ok) {
            await throwSessionApiError(
                response,
                ErrorMessages.passwordResetError,
            );
        }
        window.location.reload();
    } catch (err) {
        console.error(err);
        throw err;
    }
}

export async function login(
    event: React.FormEvent<HTMLFormElement>,
    username: string,
    password: string,
    navigate: NavigateFunction,
) {
    event.preventDefault();
    await ApiHelper.ensureCSRF();
    const response = await fetch(
        ApiHelper.API_URL + "/_allauth/browser/v1/auth/login",
        {
            method: "POST",
            headers: ApiHelper.getJsonHeaders(),
            credentials: "include",
            body: JSON.stringify({
                username: username,
                password: password,
            }),
        },
    );

    if (response.status >= 200 && response.status <= 299) {
        await response.json();
        getSession();
        window.location.reload();
        return;
    }

    if (response.status === 401) {
        const data =
            (await response
                .clone()
                .json()
                .catch(() => undefined)) as
            | { data?: { flows?: Array<{ id: string; is_pending?: boolean }> } }
            | undefined;
        const mfaFlow = data?.data?.flows?.find(
            (element: { id: string; is_pending?: boolean }) =>
                element.id === "mfa_authenticate" && element.is_pending,
        );
        if (mfaFlow) {
            await ApiHelper.ensureCSRF();
            await fetch(ApiHelper.API_URL + "/api/get-totp/", {
                method: "POST",
                headers: ApiHelper.getJsonHeaders(),
                credentials: "include",
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            });
            navigate?.("/login-2fa");
            return;
        }
    }

    await throwSessionApiError(response, ErrorMessages.invalidCredentials);
}

export async function login2fa(
    event: React.FormEvent<HTMLFormElement>,
    code: string,
) {
    event.preventDefault();
    await ApiHelper.ensureCSRF();
    const response = await fetch(
        ApiHelper.API_URL + "/_allauth/browser/v1/auth/2fa/authenticate",
        {
            method: "POST",
            headers: ApiHelper.getJsonHeaders(),
            credentials: "include",
            body: JSON.stringify({
                code: code,
            }),
        },
    );
    if (!response.ok) {
        await throwSessionApiError(response, ErrorMessages.twoFaError);
    }
    await response.json();
    getSession();
    window.location.reload();
}

export async function logout() {
    await ApiHelper.ensureCSRF();
    const response = await fetch(
        ApiHelper.API_URL + "/_allauth/browser/v1/auth/session",
        {
            method: "DELETE",
            headers: ApiHelper.getJsonHeaders(),
            credentials: "include",
        },
    );
    if (response.status === 401) {
        getSession();
        window.location.reload();
        return;
    }
    if (!response.ok) {
        await throwSessionApiError(response, ErrorMessages.logoutError);
    }
}

export async function sendRecoveryEmail(email: string) {
    await ApiHelper.ensureCSRF();
    const response = await fetch(
        ApiHelper.API_URL + "/_allauth/browser/v1/auth/password/request",
        {
            method: "POST",
            headers: ApiHelper.getJsonHeaders(),
            credentials: "include",
            body: JSON.stringify({
                email,
            }),
        },
    );
    if (!response.ok) {
        await throwSessionApiError(response, ErrorMessages.recoveryError);
    }
}
export async function loginGoogle() {
    await ApiHelper.ensureCSRF();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${ApiHelper.API_URL}/_allauth/browser/v1/auth/provider/redirect`;
    form.style.display = "none";

    const addInput = (name: string, value: string) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    addInput("provider", "google");
    addInput("callback_url", "http://localhost:5173");
    addInput("process", "login");
    addInput("csrfmiddlewaretoken", ApiHelper.CSRF);

    document.body.appendChild(form);
    form.submit();
}
