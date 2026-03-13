import { Link, useNavigate } from "react-router";
import { login, loginGoogle } from "./SessionController";
import { useState } from "react";
let username = "";
let password = "";

export default function Login() {
    const navigate = useNavigate();
    const [error, setError] = useState<string>("");

    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Iniciar Sesión</h5>
                    <div className="card-body">
                        <form
                            onSubmit={(event) =>
                                login(
                                    event,
                                    username,
                                    password,
                                    navigate,
                                    setError,
                                )
                            }
                        >
                            <div className="form-group mb-3">
                                <label htmlFor="username">
                                    Nombre de usuario:
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="username"
                                    name="username"
                                    onChange={handleUserNameChange}
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label htmlFor="password">Contraseña:</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    id="password"
                                    name="password"
                                    onChange={handlePasswordChange}
                                />
                                <div>
                                    {error && (
                                        <small className="text-danger">
                                            {error}
                                        </small>
                                    )}
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary me-lg-2 mb-2 mb-lg-0"
                            >
                                Iniciar Sesión
                            </button>
                            <Link
                                to="/recover-pass/"
                                className="btn btn-warning"
                            >
                                Olvidé mi contraseña
                            </Link>
                            <button
                                type="button"
                                className="btn btn-danger ms-5"
                                onClick={loginGoogle}
                            >
                                Login Google
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    password = event.target.value;
}

function handleUserNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    username = event.target.value;
}
