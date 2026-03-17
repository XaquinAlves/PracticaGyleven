import type { NeosResponse } from "./NeosModel";

export type NeosViewPhase = "loading" | "error" | "data" | "empty";

export interface NeosViewStatus {
    loading: boolean;
    error: string;
    neos: NeosResponse | null;
}

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
