import type { NeosResponse } from "./NeosModel";

/** Etapas posibles para renderizar la vista (cargando, error, con datos o vacía). */
export type NeosViewPhase = "loading" | "error" | "data" | "empty";

/** Estado simplificado que usa `NeosView` para decidir qué mostrar. */
export interface NeosViewStatus {
    loading: boolean;
    error: string;
    neos: NeosResponse | null;
}

/**
 * Devuelve la fase actual según carga/errores/datos para simplificar la UI.
 */
export function getNeosViewPhase({
    loading,
    error,
    neos,
}: NeosViewStatus): NeosViewPhase {
    if (loading) {
        return "loading";
    }
    if (error) {
        return "error";
    }
    if (neos && neos.neos.length > 0) {
        return "data";
    }
    return "empty";
}
