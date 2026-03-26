import Sidebar from "./common/Sidebar";
import { useSessionActions, useAuth } from "./session/auth";
import { useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";

/**
 * Pantalla principal que muestra el nombre del usuario y ofrece logout.
 */
export default function Inicio() {
    const [error, setError] = useState<string>("");
    const { logout } = useSessionActions();
    const { currentUser } = useAuth();

    const handleLogout = async () => {
        try {
            setError("");
            await logout();
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
                        <h5 className="card-header">
                            Bienvenido {currentUser || "Usuario"}
                        </h5>
                        <div className="card-body">
                            {error && <ErrorAlert message={error} />}
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
