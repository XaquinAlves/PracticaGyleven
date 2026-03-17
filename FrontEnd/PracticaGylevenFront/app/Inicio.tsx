import Sidebar from "./common/Sidebar";
import { logout, whoami } from "./session/SessionController";
import { useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";

export default function Inicio() {
    const [error, setError] = useState<string>("");

    const handleLogout = async () => {
        try {
            setError("");
            await logout();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleWhoami = async () => {
        try {
            setError("");
            await whoami();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="row">
            <Sidebar />
            <div className="col-8 col-lg-10">
                <div className="row justify-content-center">
                    <div className="card mt-5 ms-5 w-auto">
                        <h5 className="card-header">Iniciar Sesión</h5>
                        <div className="card-body">
                            {error && <ErrorAlert message={error} />}
                            <p>Has iniciado sesión correctamente.</p>
                            <button
                                className="btn btn-primary me-2"
                                onClick={handleWhoami}
                            >
                                Quien soy ?
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleLogout}
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
