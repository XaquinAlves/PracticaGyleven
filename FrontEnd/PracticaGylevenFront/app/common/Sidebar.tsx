import { Link } from "react-router";
import { logout, get_username } from "../session/SessionController";
import { useState, useEffect } from "react";

export default function Sidebar() {
    const [username, setUsername] = useState<string>("");

    useEffect(() => {
        const obtenerUsername = async () => {
            const username = await get_username();
            setUsername(username);
        };
        obtenerUsername();
    }, []);

    return (
        <div
            className="d-flex flex-column flex-shrink-0 p-3 text-white bg-dark col-3 col-lg-2 sticky-top"
            style={{ width: 280 + "px", height: 100 + "vh" }}
        >
            <a
                href="/"
                className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none"
            >
                <svg className="bi me-2" width="40" height="32">
                    <use xlinkHref="#bootstrap"></use>
                </svg>
                <span className="fs-4">Menú</span>
            </a>
            <hr />
            <ul className="nav nav-pills flex-column mb-auto">
                <li className="nav-item">
                    <Link to="/inicio" className="nav-link text-white">
                        <svg className="bi me-2" width="16" height="16">
                            <use xlinkHref="#home"></use>
                        </svg>
                        Inicio
                    </Link>
                </li>
                <li>
                    <Link to="/neos" className="nav-link text-white">
                        <svg className="bi me-2" width="16" height="16">
                            <use xlinkHref="#speedometer2"></use>
                        </svg>
                        Registros NEOs
                    </Link>
                </li>
                <li>
                    <Link to="/invoices" className="nav-link text-white">
                        <svg className="bi me-2" width="16" height="16">
                            <use xlinkHref="#speedometer2"></use>
                        </svg>
                        Facturas
                    </Link>
                </li>
                <li>
                    <Link to="/media" className="nav-link text-white">
                        <svg className="bi me-2" width="16" height="16">
                            <use xlinkHref="#speedometer2"></use>
                        </svg>
                        Directorios y ficheros
                    </Link>
                </li>
                <li>
                    <Link to="/important-files" className="nav-link text-white">
                        <svg className="bi me-2" width="16" height="16">
                            <use xlinkHref="#speedometer2"></use>
                        </svg>
                        Archivos importantes
                    </Link>
                </li>
            </ul>
            <hr />
            <div className="dropdown">
                <a
                    href="#"
                    className="d-flex align-items-center text-white text-decoration-none dropdown-toggle"
                    id="dropdownUser1"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                >
                    <img
                        src="https://cdn-icons-png.freepik.com/512/6543/6543634.png"
                        alt=""
                        width="32"
                        height="32"
                        className="rounded-circle me-2"
                    />
                    <strong>User: {username}</strong>
                </a>
                <ul
                    className="dropdown-menu dropdown-menu-dark text-small shadow"
                    aria-labelledby="dropdownUser1"
                >
                    <li>
                        <a className="dropdown-item" href="#">
                            Perfil
                        </a>
                    </li>
                    <li>
                        <Link to="/settings" className="dropdown-item">
                            Ajustes
                        </Link>
                    </li>
                    <li>
                        <hr className="dropdown-divider" />
                    </li>
                    <li>
                        <button className="dropdown-item" onClick={logout}>
                            Cerrar sesión
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    );
}
