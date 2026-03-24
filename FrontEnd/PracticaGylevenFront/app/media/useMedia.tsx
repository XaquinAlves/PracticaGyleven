import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    type DirectoryProps,
    type ImportantFile,
    fetchImportantFiles,
    fetchMediaTree,
    fetchMediaTreeVersion,
} from "./MediaModel";
import { subscribeMediaTreeUpdates } from "./mediaUpdates";
import { ErrorMessages } from "~/common/messageCatalog";

interface MediaContextValue {
    directories?: DirectoryProps;
    importantFiles: ImportantFile[];
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
    toggleDirectory: (relativePath: string) => void;
    isDirectoryExpanded: (relativePath: string) => boolean;
}

function normalizeRelativePath(relativePath?: string) {
    return relativePath ?? "";
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

export function MediaProvider({ children }: { children: ReactNode }) {
    const [expandedDirectories, setExpandedDirectories] = useState<string[]>(
        [],
    );
    const [directories, setDirectories] = useState<DirectoryProps>();
    const [importantFiles, setImportantFiles] = useState<ImportantFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [treeVersion, setTreeVersion] = useState("");
    const [useVersionPoll, setUseVersionPoll] = useState(true);
    //Carga el listado de directorios y ficheros del servidor
    const loadMedia = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            //Carga el arbol de archivos y lo establece
            const entries = await fetchMediaTree();
            const root: DirectoryProps = {
                name: "media",
                type: "directory",
                relativePath: "",
                children: entries,
            };
            setDirectories(root);
            //Carga los archivos marcados como importantes
            const important = await fetchImportantFiles();
            setImportantFiles(important);
            if (useVersionPoll) {
                const version = await fetchMediaTreeVersion();
                setTreeVersion(version);
            } else {
                setTreeVersion("");
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : ErrorMessages.mediaError,
            );
            throw err;
        } finally {
            setLoading(false);
        }
    }, [useVersionPoll]);

    useEffect(() => {
        void loadMedia();
    }, [loadMedia]);
    //Compara versiones periódicamente con el hash, 15000ms de intervalo
    useEffect(() => {
        if (!useVersionPoll) {
            return;
        }
        const intervalId = setInterval(async () => {
            if (loading) {
                return;
            }
            try {
                const version = await fetchMediaTreeVersion();
                if (version && version !== treeVersion) {
                    void loadMedia();
                }
            } catch (err) {
                console.error("Error checking media version", err);
            }
        }, 15000);
        return () => clearInterval(intervalId);
    }, [loading, loadMedia, treeVersion, useVersionPoll]);

    useEffect(() => {
        const unsubscribe = subscribeMediaTreeUpdates(() => {
            if (loading) {
                return;
            }
            void loadMedia();
        });
        return unsubscribe;
    }, [loading, loadMedia]);

    // Validación de media por WebSocket
    const loadMediaRef = useRef(loadMedia);

    useEffect(() => {
        loadMediaRef.current = loadMedia;
    }, [loadMedia]);

    useEffect(() => {
        let socket: WebSocket | null = null;
        let reconnectTimer: number | undefined;

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const connect = () => {
            socket = new WebSocket(
                `${protocol}://localhost:8000/ws/media-updates/`,
            );

            socket.addEventListener("open", () => {
                setUseVersionPoll(false);
            });

            socket.addEventListener("message", (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.action === "refresh") {
                        void loadMediaRef.current?.();
                    }
                } catch (err) {
                    console.error("Invalid media update payload", err);
                }
            });

            socket.addEventListener("close", (event) => {
                console.error("media ws closed", event);
                setUseVersionPoll(true);
                reconnectTimer = window.setTimeout(connect, 1000);
            });

            socket.addEventListener("error", () => {
                setUseVersionPoll(true);
                socket?.close();
            });
        };

        connect();

        return () => {
            if (reconnectTimer) {
                window.clearTimeout(reconnectTimer);
            }
            socket?.close();
        };
    }, []);

    //Para abrir/cerrar una carpeta
    const toggleDirectory = useCallback((relativePath: string) => {
        setExpandedDirectories((previous) => {
            const normalized = normalizeRelativePath(relativePath);
            const alreadyExpanded = previous.includes(normalized);
            if (alreadyExpanded) {
                return previous.filter((path) => path !== normalized);
            }
            return [...previous, normalized];
        });
    }, []);
    //Para comprobar si la carpeta estaba abierta cuando hay una recarga
    const isDirectoryExpanded = useCallback(
        (relativePath: string) =>
            expandedDirectories.includes(normalizeRelativePath(relativePath)),
        [expandedDirectories],
    );

    const value = useMemo(
        () => ({
            directories,
            importantFiles,
            loading,
            error,
            refresh: loadMedia,
            toggleDirectory,
            isDirectoryExpanded,
        }),
        [
            directories,
            importantFiles,
            loading,
            error,
            loadMedia,
            toggleDirectory,
            isDirectoryExpanded,
        ],
    );

    return (
        <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
    );
}

export function useMedia() {
    const context = useContext(MediaContext);
    if (!context) {
        throw new Error("useMedia must be used within a MediaProvider");
    }
    return context;
}
