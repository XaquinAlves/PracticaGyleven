import { Link, useNavigate } from "react-router";
import { login, loginGoogle } from "./SessionController";
import { useState, type FormEvent } from "react";
import { ErrorMessages } from "~/common/messageCatalog";
import ErrorAlert from "~/common/ErrorAlert";
let username = "";
let password = "";

export default function Login() {
    const navigate = useNavigate();
    const [error, setError] = useState<string>("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        try {
            setError("");
            await login(event, username, password, navigate);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : ErrorMessages.loginGenericError,
            );
        }
    };

    return (
        <div className="row justify-content-center mt-5">
            <div className="col-6 col-md-4 mt-5">
                <div className="card mt-5">
                    <h5 className="card-header">Iniciar Sesión</h5>
                    <div className="card-body">
                        {error && (
                            <div className="mt-3">
                                <ErrorAlert message={error} />
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="form-group mb-3">
                                <label htmlFor="username">
                                    Nombre de usuario:
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="username"
                                    name="username"
                                    required={true}
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
                                    required={true}
                                    onChange={handlePasswordChange}
                                />
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
