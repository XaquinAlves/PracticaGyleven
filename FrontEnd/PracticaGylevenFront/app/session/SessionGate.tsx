import { Outlet } from "react-router";
import { useRequireAuth } from "./auth";

export default function SessionGate() {
    const { isLoading, isAuthenticated } = useRequireAuth();

    if (isLoading || !isAuthenticated) {
        return (
            <div className="spinner-border text-center" role="status">
                <span className="visually-hidden">Cargando...</span>
            </div>
        );
    }

    return <Outlet />;
}
