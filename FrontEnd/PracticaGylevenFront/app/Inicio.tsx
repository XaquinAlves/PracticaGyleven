import Sidebar from "./common/Sidebar";
import { logout, get_username } from "./session/SessionController";
import { useEffect, useState } from "react";
import ErrorAlert from "~/common/ErrorAlert";

export default function Inicio() {
    const [error, setError] = useState<string>("");
    const [username, setUsername] = useState<string>("");

        useEffect(() => {
            const obtenerUsername = async () => {
                const username = await get_username();
                setUsername(username);
            };
            obtenerUsername();
        }, []);

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
                        <h5 className="card-header">Iniciar Sesión</h5>
                        <div className="card-body">
                            {error && <ErrorAlert message={error} />}
                            <p>Bienvenido {username}</p>
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
