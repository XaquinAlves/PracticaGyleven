import ApiHelper from "~/common/ApiHelper";
import type { Route } from "./+types/home";
import Inicio from "~/Inicio";

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

export default function Home() {
    return <Inicio/>
}

export async function getCSRF() {
    try {
        const response = await fetch(ApiHelper.API_URL + "/api/csrf/", {
            credentials: "include",
        });
        if (response.ok) {
            let csrfToken = response.headers.get("x-csrftoken");
            let stringToken;
            if (csrfToken === null) {
                stringToken = "";
            } else {
                stringToken = csrfToken;
            }
            ApiHelper.CSRF = stringToken;
        } else {
            throw Error(response.statusText);
        }
    } catch (err) {
        console.error(err);
    }
}

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
        alert("Error de red al verificar la sesión.");
        return false;
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
}

export async function componentDidMount() {
    await getSession();
}