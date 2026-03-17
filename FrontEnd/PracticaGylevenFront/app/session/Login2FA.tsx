import type React from "react";
import { login2fa } from "./SessionController";
let code = ""

export default function Login2FA() {
    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Iniciar Sesión</h5>
                    <div className="card-body">
                        <form onSubmit={(evn) => login2fa(evn, code)}>
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
                                    onChange={handleCodeChange}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">
                                Enviar
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

function handleCodeChange(evn: React.ChangeEvent<HTMLInputElement>) {
    code = evn.target.value;
}
