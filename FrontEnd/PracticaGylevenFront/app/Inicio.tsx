import Sidebar from "./common/Sidebar";
import { logout, whoami } from "./session/SessionController";

export default function Inicio() {
    return (
        <div className="row">
            <Sidebar />
            <div className="col-8 col-lg-10">
                <div className="row justify-content-center">
                    <div className="card mt-5 ms-5 w-auto">
                        <h5 className="card-header">Iniciar Sesión</h5>
                        <div className="card-body">
                            <p>Has iniciado sesión correctamente.</p>
                            <button
                                className="btn btn-primary me-2"
                                onClick={whoami}
                            >
                                Quien soy ?
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={logout}
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
