import React from "react";
import type { NavigateFunction } from "react-router";
import { getSession } from "~/routes/home";
import ApiHelper from "~/common/ApiHelper";

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
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
}

export async function changePass(
    event: React.SubmitEvent<HTMLFormElement>,
    oldPassword: string,
    newPassword: string,
    repeatPassword: string,
) {
    event.preventDefault();

    if (newPassword !== repeatPassword) {
        alert("Las contraseñas no coinciden");
    } else {
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
            if (response.ok) {
                alert("Contraseña cambiada correctamente");
            } else {
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error de red al cambiar la contraseña.");
        }
    }
    // https://docs.allauth.org/_allauth/{client}/v1/account/password/change
}

export async function resetPass(
    event: React.SubmitEvent<HTMLFormElement>,
    password: string,
    repeatPassword: string,
    key: string,
) {
    event.preventDefault();
    if (password !== repeatPassword) {
        alert("Las contraseñas no coinciden");
    } else {
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
            if (response.ok) {
                alert("Contraseña cambiada correctamente");
                window.location.reload();
            } else {
                throw Error(response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert("Error de red al cambiar la contraseña.");
        }
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/password/reset
}

export async function login(
    event: React.FormEvent<HTMLFormElement>,
    username: string,
    password: string,
    navigate: NavigateFunction,
    setError: { (value: React.SetStateAction<string>): void; (arg0: string): void; }
) {
    event.preventDefault();
    try {
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
            const user_data = await response.json();
            getSession();
            window.location.reload();
        } else if (response.status == 401) {
            const data = await response.json();
            let pending2fa = false;
            const mfaFlow = data?.data?.flows?.find(
                (element: { id: string; is_pending?: boolean }) =>
                    element.id === "mfa_authenticate" && element.is_pending,
            );
            if (mfaFlow) {
                pending2fa = true;
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
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        setError("Usuario y/o contraseña incorrectos")
        console.error(err);
        getSession();
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/login
}

export async function login2fa(
    event: React.FormEvent<HTMLFormElement>,
    code: string,
) {
    //https://docs.allauth.org/_allauth/{client}/v1/auth/2fa/authenticate
    event.preventDefault();
    try {
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
        if (response.ok) {
            const user_data = await response.json();
            getSession();
            window.location.reload();
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
        getSession();
    }
}

export async function logout() {
    try {
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
            getSession()
            window.location.reload();
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
        alert("Error de red al cerrar sesión.");
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
}


export async function sendRecoveryEmail(
    event: React.SubmitEvent<HTMLFormElement>,
) {
    event.preventDefault();
    try {
        await ApiHelper.ensureCSRF();
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/auth/password/request",
            {
                method: "POST",
                headers: ApiHelper.getJsonHeaders(),
                credentials: "include",
                body: JSON.stringify({
                    email: event.target.email.value,
                }),
            },
        );
        if (response.ok) {
            alert("Email enviado correctamente");
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
        alert("Error al recuperar contraseña");
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/password/request
}

export async function loginGoogle() {
    await ApiHelper.ensureCSRF();
    //https://docs.allauth.org/_allauth/{client}/v1/auth/provider/token
    //https://docs.allauth.org/_allauth/browser/v1/auth/provider/redirect
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
