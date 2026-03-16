import type React from "react";
import { TOTP } from "totp-generator";
import ApiHelper from "~/common/ApiHelper";
let email = "";

export default function Activate2FA() {
    return (
        <div className="card mt-5 ms-5 w-auto h-25 col-4 col-lg-5">
            <h2 className="card-header text-center">
                Activar Autenticación de doble factor
            </h2>
            <div className="card-body">
                <p>
                    Para activar la ADF, primero tu email debe estar confirmado
                </p>
                <div className="form-group mb-3">
                    <label htmlFor="user_email">Correo :</label>
                    <input
                        type="email"
                        className="form-control mb-2"
                        id="user_email"
                        name="user_email"
                        onChange={handleEmailChange}
                    />
                    <button
                        type="button"
                        className="btn btn-warning"
                        onClick={confirmEmail}
                    >
                        Mandar correo verificación
                    </button>
                </div>
                <button
                    type="button"
                    className="btn btn-success"
                    onClick={activate2FA}
                >
                    Activar 2FA
                </button>
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={deactivate2FA}
                >
                    Desactivar 2FA
                </button>
            </div>
        </div>
    );

    function handleEmailChange(event: React.ChangeEvent<HTMLInputElement>) {
        email = event.target.value;
    }
}

async function activate2FA() {
    // https://docs.allauth.org/_allauth/{client}/v1/account/authenticators/totp"
    // https://docs.allauth.org/_allauth/{client}/v1/account/authenticators/totp

    try {
        await ApiHelper.ensureCSRF();
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/account/authenticators/totp",
            {
                headers: ApiHelper.getJsonHeaders(false),
                credentials: "include",
            },
        );
        if (response.ok || response.status === 404) {
            const data = await response.json();
            let secret = await data.meta.secret;
            const { otp, expires } = await TOTP.generate(secret);
            const second_response = await fetch(
                ApiHelper.API_URL +
                    "/_allauth/browser/v1/account/authenticators/totp",
                {
                    method: "POST",
                    headers: ApiHelper.getJsonHeaders(),
                    credentials: "include",
                    body: JSON.stringify({
                        code: otp,
                    }),
                },
            );
            if (second_response.ok) {
                alert("Autenticación de doble factor activada")
            } else {
                throw Error(second_response.statusText)
            }
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
        alert("Error de red al activar 2FA.");
    }
}

async function confirmEmail() {
    //https://docs.allauth.org/_allauth/{client}/v1/account/email
    try {
        await ApiHelper.ensureCSRF();
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/account/email",
            {
                method: "PUT",
                headers: ApiHelper.getJsonHeaders(),
                credentials: "include",
                body: JSON.stringify({
                    email: email,
                }),
            },
        );
        if (response.ok) {
            alert("Correo de verificación enviado");
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
        alert("Error de red al enviar el correo.");
    }
}

async function deactivate2FA() {
    try {
        await ApiHelper.ensureCSRF();
        const response = await fetch(
            ApiHelper.API_URL +
                "/_allauth/browser/v1/account/authenticators/totp",
            {
                method: "DELETE",
                headers: ApiHelper.getJsonHeaders(),
                credentials: "include",
            },
        );
        if (response.ok) {
            alert("2FA desactivado")
        }
    } catch (err) {
        console.error(err);
        alert("Error de red al desactivar ADF")
    }
}
