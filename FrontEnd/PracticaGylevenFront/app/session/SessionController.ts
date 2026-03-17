import React from "react";
import type { NavigateFunction } from "react-router";
import { getSession } from "~/routes/home";
import ApiHelper from "~/common/ApiHelper";

async function parseDetail(response: Response) {
    try {
        const data = await response.json();
        if (data && typeof data.detail === "string") {
            return data.detail;
        }
    } catch (err) {
        console.error("Could not parse error detail", err);
    }
    return response.statusText || "Error del servidor";
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
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
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
        throw new Error("Las contraseñas no coinciden");
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
                return;
            } else {
                const detail = await parseDetail(response);
                throw Error(detail || "No se pudo cambiar la contraseña");
            }
        } catch (err) {
            console.error(err);
            throw err;
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
        throw new Error("Las contraseñas no coinciden");
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
                window.location.reload();
          } else {
              const detail = await parseDetail(response);
              throw Error(detail || "No se pudo restablecer la contraseña");
          }
      } catch (err) {
          console.error(err);
            throw err;
      }
  }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/password/reset
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
        const data = await response.json();
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

    const detail = await parseDetail(response);
    throw new Error(detail || "Usuario y/o contraseña incorrectos");
}

export async function login2fa(
    event: React.FormEvent<HTMLFormElement>,
    code: string,
) {
    //https://docs.allauth.org/_allauth/{client}/v1/auth/2fa/authenticate
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
        const detail = await parseDetail(response);
        throw new Error(detail || "Código de autenticación incorrecto");
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
    const detail = await parseDetail(response);
    throw new Error(detail || "No se pudo cerrar la sesión");
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
}


export async function sendRecoveryEmail(
    event: React.SubmitEvent<HTMLFormElement>,
) {
    event.preventDefault();
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
    if (!response.ok) {
        const detail = await parseDetail(response);
        throw new Error(detail || "Error al recuperar contraseña");
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
