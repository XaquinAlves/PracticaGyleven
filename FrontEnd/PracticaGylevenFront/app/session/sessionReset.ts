type ResetHandler = () => void;
const handlers = new Set<ResetHandler>();

export function registerSessionReset(handler: ResetHandler) {
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
    };
}

export function triggerSessionReset() {
    handlers.forEach((handler) => handler());
}
