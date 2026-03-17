import type React from "react";
import { Link } from "react-router";
import { useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import { sendRecoveryEmail } from "./SessionController";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecoverPass() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus(null);
        if (!EMAIL_REGEX.test(email.trim())) {
            setStatus({
                type: "error",
                message: "Introduce un correo electrónico válido.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await sendRecoveryEmail(email);
            setStatus({
                type: "success",
                message: "Si existe el usuario, recibirás un correo en breve.",
            });
            setEmail("");
        } catch (err) {
            setStatus({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "No se pudo enviar el correo.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Recuperar Contraseña</h5>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group mb-3">
                                <label htmlFor="email">
                                    Ingresa tu correo electrónico:
                                </label>
                                <input
                                    type="email"
                                    className="form-control"
                                    id="email"
                                    name="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    required
                                />
                            </div>
                            {status?.type === "error" && (
                                <ErrorAlert
                                    message={status.message}
                                    className="mb-3"
                                />
                            )}
                            {status?.type === "success" && (
                                <div
                                    className="alert alert-success mb-3"
                                    role="alert"
                                >
                                    {status.message}
                                </div>
                            )}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? "Enviando..."
                                    : "Enviar correo de recuperación"}
                            </button>
                        </form>
                    </div>
                    <div className="card-footer">
                        <Link to="/login" className="btn btn-secondary">
                            Volver
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

