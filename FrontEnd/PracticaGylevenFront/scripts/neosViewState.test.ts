import assert from "node:assert/strict";
import {
    getNeosViewPhase,
    type NeosViewStatus,
} from "../app/neos/neosViewState.ts";

const base: NeosViewStatus = {
    loading: false,
    error: "",
    neos: null,
};

assert.strictEqual(
    getNeosViewPhase({ ...base, loading: true }),
    "loading",
    "La fase debe ser \"loading\" cuando loading está activo",
);

assert.strictEqual(
    getNeosViewPhase({ ...base, error: "fallo" }),
    "error",
    "La fase debe ser \"error\" cuando hay un mensaje",
);

assert.strictEqual(
    getNeosViewPhase({ ...base, neos: { neos: [] } }),
    "empty",
    "Si no hay NEOs y no hay error, se muestra el estado vacío",
);

assert.strictEqual(
    getNeosViewPhase({
        ...base,
        neos: {
            neos: [
                {
                    id: 1,
                    name: "Demo",
                    estimated_diameter_km_min: 0.1,
                    estimated_diameter_km_max: 0.2,
                    is_potentially_hazardous: false,
                },
            ],
        },
    }),
    "data",
    "Con NEOs válidos debe mostrarse la tabla",
);

console.log("NeosView state helper test passed");
