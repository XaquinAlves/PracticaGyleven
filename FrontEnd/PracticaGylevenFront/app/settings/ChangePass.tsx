import type React from "react";
import { useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";
import {
    changePass,
    ensurePasswordStrength,
} from "~/session/SessionController";

export default function ChangePass() {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (evn: React.FormEvent<HTMLFormElement>) => {
        evn.preventDefault();
        setStatus(null);
        if (newPassword !== repeatPassword) {
            setStatus({
                type: "error",
                message: "Las contraseñas no coinciden.",
            });
            return;
        }

        try {
            ensurePasswordStrength(newPassword);
        } catch (err) {
            setStatus({
                type: "error",
                message: err instanceof Error ? err.message : "Contraseña inválida.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await changePass(evn, oldPassword, newPassword, repeatPassword);
            setStatus({
                type: "success",
                message: "Contraseña actualizada correctamente.",
            });
            setOldPassword("");
            setNewPassword("");
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
        <div className="card mt-5 ms-5 w-auto h-25 col-4 col-lg-5">
            <h2 className="card-header text-center">Cambiar contraseña</h2>
            <form onSubmit={handleSubmit}>
                <div className="card-body">
                    <div className="form-group mb-3">
                        <label htmlFor="old_password">Contraseña actual:</label>
                        <input
                            type="password"
                            className="form-control"
                            id="old_password"
                            name="old_password"
                            value={oldPassword}
                            onChange={(event) => setOldPassword(event.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group mb-3">
                        <label htmlFor="new_password">Nueva contraseña:</label>
                        <input
                            type="password"
                            className="form-control"
                            id="new_password"
                            name="new_password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group mb-3">
                        <label htmlFor="confirm_password">Confirmar nueva contraseña:</label>
                        <input
                            type="password"
                            className="form-control"
                            id="confirm_password"
                            name="confirm_password"
                            value={repeatPassword}
                            onChange={(event) => setRepeatPassword(event.target.value)}
                            required
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
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Cambiando..." : "Cambiar contraseña"}
                    </button>
                </div>
            </form>
        </div>
    );
}
