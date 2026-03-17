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

export default function Home() {
    return <Inicio />;
}

export async function getCSRF() {
    try {
        await ApiHelper.refreshCSRF();
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
        alert(ErrorMessages.sessionCheckFailed);
        return false;
    }
    // https://docs.allauth.org/_allauth/{client}/v1/auth/session
}

export async function componentDidMount() {
    await getSession();
}
