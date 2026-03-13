import { Link } from "react-router";
import { sendRecoveryEmail } from "./SessionController";

export default function RecoverPass() {
    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Recuperar Contraseña</h5>
                    <div className="card-body">
                        <form onSubmit={sendRecoveryEmail}>
                            <div className="form-group mb-3">
                                <label htmlFor="email">
                                    Ingresa tu correo electrónico:
                                </label>
                                <input
                                    type="email"
                                    className="form-control"
                                    id="email"
                                    name="email"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">
                                Enviar correo de recuperación
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

