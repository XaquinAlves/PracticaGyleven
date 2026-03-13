import type React from "react";
import { changePass } from "~/session/SessionController";
let password = "";
let repeat_password = "";
let old_password = "";

export default function ChangePass() {
    return (
            <div className="card mt-5 ms-5 w-auto h-25 col-4 col-lg-5">
                <h2 className="card-header text-center">Cambiar contraseña</h2>
                <form
                    onSubmit={(evn) =>
                        changePass(
                            evn,
                            old_password,
                            password,
                            repeat_password,
                        )
                    }
                >
                    <div className="card-body">
                        <div className="form-group mb-3">
                            <label htmlFor="old_password">
                                Nueva contraseña:
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                id="old_password"
                                name="old_password"
                                onChange={handleOldPasswordChange}
                            />
                        </div>
                        <div className="form-group mb-3">
                            <label htmlFor="new_password">
                                Nueva contraseña:
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                id="new_password"
                                name="new_password"
                                onChange={handlePasswordChange}
                            />
                        </div>
                        <div className="form-group mb-3">
                            <label htmlFor="confirm_password">
                                Confirmar nueva contraseña:
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                id="confirm_password"
                                name="confirm_password"
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
    );

    function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
        password = event.target.value;
    }

    function handleRepeatPasswordChange(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        repeat_password = event.target.value;
    }

    function handleOldPasswordChange(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        old_password = event.target.value;
    }
}
