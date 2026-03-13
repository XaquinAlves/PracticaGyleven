import type React from "react";
import { useParams } from "react-router";
import { resetPass } from "./SessionController";

let password = "";
let repeat_password = "";

export default function ChangePass() {
    let params = useParams();
    let key;
    if (params.key === undefined) {
        key = "";
    } else {
        key = params.key;
    }
    return (
        <div className="row justify-content-center">
            <div className="card mt-5 ms-5 w-auto h-25">
                <h2 className="card-header text-center">Cambiar contraseña</h2>
                <form
                    onSubmit={(evn) =>
                        resetPass(evn, password, repeat_password, key)
                    }
                >
                    <div className="card-body">
                        <div className="form-group mb-3">
                            <label htmlFor="password">Nueva contraseña:</label>
                            <input
                                type="password"
                                className="form-control"
                                id="password"
                                name="password"
                                onChange={handlePasswordChange}
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
                                onChange={handleRepeatPasswordChange}
                            />
                        </div>
                    </div>
                    <div className="card-footer">
                        <button type="submit" className="btn btn-primary">
                            Cambiar contraseña
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
        password = event.target.value;
    }

    function handleRepeatPasswordChange(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        repeat_password = event.target.value;
    }
}
