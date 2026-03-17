import Sidebar from "~/common/Sidebar";
import DirectoryComponent from "./DirectoryComponent";
import MediaUploadForm from "./MediaUploadForm";
import ErrorAlert from "~/common/ErrorAlert";
import { ErrorMessages } from "~/common/messageCatalog";
import { MediaProvider, useMedia } from "./useMedia";

export default function MediaView() {
    return (
        <MediaProvider>
            <MediaViewContent />
        </MediaProvider>
    );
}

export function MediaViewContent() {
    const { directories, loading, error, refresh } = useMedia();

    const handleChanges = () => {
        void refresh();
    };

    return (
        <div className="row">
            <Sidebar />
            <div className="row justify-content-center col-9 col-lg-10">
                <div className="col-12">
                    <MediaUploadForm
                        onUploadSuccess={handleChanges}
                        onChange={handleChanges}
                    />
                </div>
                <div className="col-12 col-md-12 mt-5">
                    {loading ? (
                        <div
                            className="spinner-border text-center"
                            role="status"
                        >
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    ) : error ? (
                        <ErrorAlert
                            message={error || ErrorMessages.genericFetch}
                            onRetry={handleChanges}
                        />
                    ) : directories ? (
                        <DirectoryComponent directory={directories} />
                    ) : (
                        <p className="text-muted">{ErrorMessages.mediaEmpty}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
