import { Navigate, Outlet } from "react-router";
import { useRequireNoAuth } from "~/session/auth";

export default function LoginGate() {
    const { isLoading, isAuthenticated } = useRequireNoAuth();

    if (isLoading) {
        return (
            <div className="spinner-border text-center" role="status">
                <span className="visually-hidden">Cargando...</span>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/inicio" replace />;
    }

    return <Outlet />;
}
