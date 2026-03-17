import type React from "react";
import { useState } from "react";
import { useParams } from "react-router";
import ErrorAlert from "~/common/ErrorAlert";
import {
    resetPass,
    ensurePasswordStrength,
} from "~/session/SessionController";

export default function ChangePass() {
    const { key = "" } = useParams();
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (evn: React.FormEvent<HTMLFormElement>) => {
        evn.preventDefault();
        setStatus(null);
        if (password !== repeatPassword) {
            setStatus({
                type: "error",
                message: "Las contraseñas no coinciden.",
            });
            return;
        }

        try {
            ensurePasswordStrength(password);
        } catch (err) {
            setStatus({
                type: "error",
                message: err instanceof Error ? err.message : "Contraseña inválida.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await resetPass(evn, password, repeatPassword, key);
            setStatus({
                type: "success",
                message: "Contraseña actualizada correctamente.",
            });
            setPassword("");
            setRepeatPassword("");
        } catch (err) {
            setStatus({
                type: "error",
                message: err instanceof Error ? err.message : "Error al cambiar la contraseña.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="row justify-content-center">
            <div className="card mt-5 ms-5 w-auto h-25">
                <h2 className="card-header text-center">Cambiar contraseña</h2>
                <form onSubmit={handleSubmit}>
                    <div className="card-body">
                        <div className="form-group mb-3">
                            <label htmlFor="password">Nueva contraseña:</label>
                            <input
                                type="password"
                                className="form-control"
                                id="password"
                                name="password"
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </div>
                        <div className="form-group mb-3">
                            <label htmlFor="confirmPassword">
                                Confirmar nueva contraseña:
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                id="confirmPassword"
                                name="confirmPassword"
                                required
                                value={repeatPassword}
                                onChange={(event) => setRepeatPassword(event.target.value)}
                            />
                        </div>
                        {status?.type === "error" && (
                            <ErrorAlert message={status.message} className="mt-3" />
                        )}
                        {status?.type === "success" && (
                            <div className="alert alert-success mt-3" role="alert">
                                {status.message}
                            </div>
                        )}
                    </div>
                    <div className="card-footer">
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Procesando..." : "Cambiar contraseña"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
