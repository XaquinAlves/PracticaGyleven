import Sidebar from "~/common/Sidebar";
import NeosTable from "./Neo";
import { useState } from "react";
import NeosModel from "./NeosModel";

export default function NeosView() {
    const [cargando, setCargando] = useState<boolean>(
        NeosModel.neos === undefined,
    );
    const neos = NeosModel.neos;

    if (cargando) {
        NeosModel.fetchNeos().then(() => {
            setCargando(false);
        });
    }

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center mt-5 col-8 col-lg-10">
                <div>
                    <div className="form-group mb-3 col-6 col-lg-2">
                        <label htmlFor="page">Número de página:</label>
                        <input
                            type="number"
                            className="form-control"
                            id="page"
                            name="page"
                            min="0"
                            defaultValue="0"
                            onChange={(evn) =>
                                NeosModel.handlePageChange(evn, setCargando)
                            }
                        />
                    </div>
                </div>
                <div className="col-12 col-md-12 mt-5">
                    {cargando ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">
                                Cargando...
                            </span>
                        </div>
                    ) : (
                        neos ? (
                            <NeosTable neos={neos.neos} />
                        ) : (
                            <p className="text-muted">
                                No se han cargado los datos todavía.
                            </p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
