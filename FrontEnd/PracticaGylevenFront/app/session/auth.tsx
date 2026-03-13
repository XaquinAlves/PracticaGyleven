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

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
}

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