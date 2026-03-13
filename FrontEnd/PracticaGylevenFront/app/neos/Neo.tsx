import NeosModel, { type NeoItem, type NeosTableProps } from "./NeosModel";

export function Neo({
    id,
    name,
    estimated_diameter_km_min,
    estimated_diameter_km_max,
    is_potentially_hazardous,
}: NeoItem): import("react/jsx-runtime").JSX.Element {
    return (
        <tr>
            <td>{id}</td>
            <td>{name}</td>
            <td>
                {estimated_diameter_km_min} - {estimated_diameter_km_max} km
            </td>
            <td>{is_potentially_hazardous ? "Sí" : "No"}</td>
        </tr>
    );
}

export default function NeosTable({ neos }: NeosTableProps) {
    return (
        <>
            <table className="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Diámetro (km)</th>
                        <th>¿Potencialmente peligroso?</th>
                    </tr>
                </thead>
                <tbody>
                    {neos.map((neo) => (
                        <Neo
                            key={neo.id}
                            {...neo}
                        />
                    ))}
                </tbody>
            </table>
            <button
                type="button"
                className="btn btn-success my-2"
                onClick={() => NeosModel.handleSaveToDatabase({ neos })}
            >
                Guardar datos en BBDD
            </button>
        </>
    );
}
