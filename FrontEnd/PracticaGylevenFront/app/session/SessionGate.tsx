import { Navigate, Outlet } from "react-router";
import { useRequireAuth } from "./auth";

export default function SessionGate() {
    const { isLoading, isAuthenticated } = useRequireAuth();

    if (isLoading) {
        return (
            <div className="spinner-border text-center" role="status">
                <span className="visually-hidden">Cargando...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
