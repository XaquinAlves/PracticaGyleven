import ApiHelper from "~/common/ApiHelper";
import type { Route } from "./+types/home";
import Inicio from "~/Inicio";
import { ErrorMessages } from "~/common/messageCatalog";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Practica Gyleven" },
        { name: "description", content: "Welcome to React Router!" },
    ];
}

export let token: string;
export let isAuthenticated: boolean;
export let username: string;
export let error: string;
export let pending2fa: boolean;

/** Página que renderiza la vista de inicio y provee helpers para el layout. */
export default function Home() {
    return <Inicio />;
}

/** Fuerza la carga del token CSRF necesario antes de enviar formularios. */
export async function getCSRF() {
    try {
        await ApiHelper.refreshCSRF();
    } catch (err) {
        console.error(err);
    }
}

/**
 * Comprueba la sesión actual con el endpoint de `allauth` y actualiza banderas globales.
 * @returns `true` si la sesión está activa; `false` en caso contrario.
 */
export async function getSession() {
    try {
        const response = await fetch(
            ApiHelper.API_URL + "/_allauth/browser/v1/auth/session",
            {
                credentials: "include",
            },
        );
        if (response.ok) {
            isAuthenticated = true;
            return true;
        } else {
            isAuthenticated = false;
            getCSRF();
            return false;
        }
    } catch (err) {
        console.error(err);
        alert(ErrorMessages.sessionCheckFailed);
        return false;
    }
}
