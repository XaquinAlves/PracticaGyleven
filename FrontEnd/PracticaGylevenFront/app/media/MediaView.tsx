import Sidebar from "~/common/Sidebar";
import { useState } from "react";
import MediaModdel from "./MediaModel";
import DirectoryComponent from "./DirectoryComponent";
import MediaUploadForm from "./MediaUploadForm";

export default function MediaView() {
    const [cargando, setCargando] = useState<boolean>(
        MediaModdel.directories === undefined,
    );

    if (cargando) {
        MediaModdel.fetchDirectories().then(() => {
            setCargando(false);
        });
    }

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <div className="col-12">
                    <MediaUploadForm
                        onUploadSuccess={() => setCargando(true)}
                    />
                </div>
                <div className="col-12 col-md-12 mt-5">
                    {cargando ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : (
                        <DirectoryComponent
                            directory={MediaModdel.directories}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
