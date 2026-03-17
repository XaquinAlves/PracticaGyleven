import type React from "react";
import { useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import { login2fa } from "./SessionController";

const CODE_REGEX = /^\d{6}$/;

export default function Login2FA() {
    const [code, setCode] = useState("");
    const [status, setStatus] = useState<{
        type: "error" | "success";
        message: string;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus(null);
        if (!CODE_REGEX.test(code)) {
            setStatus({
                type: "error",
                message: "El código debe tener 6 dígitos numéricos.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await login2fa(event, code);
            setStatus({
                type: "success",
                message: "Código enviado correctamente.",
            });
        } catch (err) {
            setStatus({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Código de autenticación incorrecto.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Iniciar Sesión</h5>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group mb-3">
                                <label htmlFor="clave">
                                    Clave de confirmación:
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="clave"
                                    name="clave"
                                    required={true}
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                />
                            </div>
                            {status?.type === "error" && (
                                <ErrorAlert
                                    className="mb-2"
                                    message={status.message}
                                />
                            )}
                            <button type="submit" className="btn btn-primary">
                                {isSubmitting ? "Verificando..." : "Enviar"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
