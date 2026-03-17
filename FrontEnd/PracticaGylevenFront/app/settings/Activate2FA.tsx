import type React from "react";
import { useState } from "react";
import { TOTP } from "totp-generator";
import ApiHelper from "~/common/ApiHelper";
import ErrorAlert from "~/common/ErrorAlert";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readDetail(response: Response) {
    try {
        const payload = await response.json();
        if (payload && typeof payload.detail === "string") {
            return payload.detail;
        }
    } catch (err) {
        console.error("Could not parse error detail", err);
    }
    return response.statusText || "Error del servidor";
}

export default function Activate2FA() {
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [status, setStatus] = useState<{
        text: string;
        variant: "success" | "danger";
    } | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const isEmailValid = EMAIL_REGEX.test(email);

    const validateEmail = () => {
        if (!email) {
            setEmailError("Introduce un correo electrónico.");
            return false;
        }
        if (!EMAIL_REGEX.test(email)) {
            setEmailError("El correo no tiene un formato válido.");
            return false;
        }
        return true;
    };

    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value.trim());
        setEmailError("");
        setStatus(null);
    };

    const handleConfirmEmail = async () => {
        if (!validateEmail()) {
            return;
        }
        setIsConfirming(true);
        setStatus(null);
        try {
            await ApiHelper.ensureCSRF();
            const response = await fetch(
                ApiHelper.API_URL + "/_allauth/browser/v1/account/email",
                {
                    method: "PUT",
                    headers: ApiHelper.getJsonHeaders(),
                    credentials: "include",
                    body: JSON.stringify({ email }),
                },
            );
            if (!response.ok) {
                const detail = await readDetail(response);
                throw new Error(detail || "No se pudo enviar el correo");
            }
            setStatus({
                text: "Correo de verificación enviado.",
                variant: "success",
            });
        } catch (err) {
            console.error(err);
            const message =
                err instanceof Error
                    ? err.message
                    : "Error de red al enviar el correo.";
            setStatus({
                text: message,
                variant: "danger",
            });
        } finally {
            setIsConfirming(false);
        }
    };

    const handleToggle2FA = async (mode: "activate" | "deactivate") => {
        setIsToggling(true);
        setStatus(null);
        try {
            await ApiHelper.ensureCSRF();
            const response = await fetch(
                ApiHelper.API_URL +
                    "/_allauth/browser/v1/account/authenticators/totp",
                {
                    headers: ApiHelper.getJsonHeaders(false),
                    credentials: "include",
                },
            );
            if (response.ok || response.status === 404) {
                const data = await response.json();
                const secret = data?.meta?.secret;
                const { otp } = await TOTP.generate(secret);
                const secondResponse = await fetch(
                    ApiHelper.API_URL +
                        "/_allauth/browser/v1/account/authenticators/totp",
                    {
                        method: mode === "activate" ? "POST" : "DELETE",
                        headers: ApiHelper.getJsonHeaders(),
                        credentials: "include",
                        body:
                            mode === "activate"
                                ? JSON.stringify({ code: otp })
                                : undefined,
                    },
                );
                if (!secondResponse.ok) {
                    const detail = await readDetail(secondResponse);
                    throw new Error(
                        detail ||
                            "No se pudo completar la operación.",
                    );
                }
                setStatus({
                    text:
                        mode === "activate"
                            ? "Autenticación de doble factor activada."
                            : "2FA desactivado.",
                    variant: "success",
                });
            } else {
                const detail = await readDetail(response);
                throw new Error(detail || "No se pudo consultar 2FA");
            }
        } catch (err) {
            console.error(err);
            const defaultMessage =
                mode === "activate"
                    ? "Error de red al activar 2FA."
                    : "Error de red al desactivar 2FA.";
            const message = err instanceof Error ? err.message : defaultMessage;
            setStatus({
                text: message,
                variant: "danger",
            });
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <div className="card mt-5 ms-5 w-auto h-25 col-4 col-lg-5">
            <h2 className="card-header text-center">
                Activar Autenticación de doble factor
            </h2>
            <div className="card-body">
                <p>Para activar la ADF, primero tu email debe estar confirmado</p>
                <div className="form-group mb-3">
                    <label htmlFor="user_email">Correo :</label>
                    <input
                        type="email"
                        className="form-control mb-2"
                        id="user_email"
                        name="user_email"
                        value={email}
                        onChange={handleEmailChange}
                        required
                        pattern={EMAIL_REGEX.source}
                        inputMode="email"
                    />
                    {emailError && (
                        <small className="text-danger d-block">
                            {emailError}
                        </small>
                    )}
                    <button
                        type="button"
                        className="btn btn-warning"
                        onClick={handleConfirmEmail}
                        disabled={isConfirming || !isEmailValid}
                    >
                        {isConfirming
                            ? "Enviando..."
                            : "Mandar correo verificación"}
                    </button>
                </div>
                <div className="d-flex gap-2">
                    <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => handleToggle2FA("activate")}
                        disabled={isToggling}
                    >
                        {isToggling ? "Procesando..." : "Activar 2FA"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleToggle2FA("deactivate")}
                        disabled={isToggling}
                    >
                        {isToggling ? "Procesando..." : "Desactivar 2FA"}
                    </button>
                </div>
                {status?.variant === "success" && (
                    <div
                        className="alert alert-success mt-3"
                        role="alert"
                    >
                        {status.text}
                    </div>
                )}
                {status?.variant === "danger" && (
                    <div className="mt-3">
                        <ErrorAlert message={status.text} />
                    </div>
                )}
            </div>
        </div>
    );
}
