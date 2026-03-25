import {
    type ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { getSession } from "~/routes/home";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
    status: AuthStatus;
    refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provee el estado global de autenticación y permite refrescar el token. */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>("loading");

    const refresh = useCallback(async () => {
        try {
            const authenticated = await getSession();
            setStatus(authenticated ? "authenticated" : "unauthenticated");
        } catch (error) {
            console.error("Failed to refresh session", error);
            setStatus("unauthenticated");
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const value = useMemo(
        () => ({
            status,
            refresh,
        }),
        [refresh, status],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

/** Hook que expone el contexto de autenticación. */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
}

/**
 * Hook que redirige a `/login` cuando el usuario no está autenticado.
 * @param redirectTo - ruta destino cuando no hay sesión activa.
 */
export function useRequireAuth({
    redirectTo = "/login",
}: { redirectTo?: string } = {}) {
    const { status } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (status === "unauthenticated") {
            navigate(redirectTo, {
                replace: true,
                state: {
                    from: location.pathname,
                },
            });
        }
    }, [status, navigate, location.pathname, redirectTo]);

    return {
        status,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
    };
}

/**
 * Hook para rutas públicas: redirige a `/inicio` si el usuario ya está autenticado.
 * @param redirectTo - ruta que recibe al usuario autenticado.
 */
export function useRequireNoAuth({
    redirectTo = "/inicio",
}: { redirectTo?: string } = {}) {
    const { status } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (status === "authenticated") {
            navigate(redirectTo, {
                replace: true,
                state: {
                    from: location.pathname,
                },
            });
        }
    }, [status, navigate, location.pathname, redirectTo]);

    return {
        status,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
    };
}
