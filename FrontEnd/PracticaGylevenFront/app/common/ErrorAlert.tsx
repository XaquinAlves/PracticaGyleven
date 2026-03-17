interface ErrorAlertProps {
    message: string;
    onRetry?: () => void;
    className?: string;
}

export default function ErrorAlert({
    message,
    onRetry,
    className,
}: ErrorAlertProps) {
    return (
        <div
            role="alert"
            className={`alert alert-danger d-flex align-items-center gap-2 ${className ?? ""}`}
        >
            <span className="flex-grow-1">{message}</span>
            {onRetry ? (
                <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={onRetry}
                >
                    Reintentar
                </button>
            ) : null}
        </div>
    );
}
