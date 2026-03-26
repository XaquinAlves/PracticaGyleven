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
import ApiHelper from "~/common/ApiHelper";
import { useSocket } from "~/common/useSocket";

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

/**
 * Provee el contexto de media (directorios, importantes, loading, errores) y maneja refrescos vía WebSocket.
 */
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
    const [mediaHash, setMediaHash] = useState("");

    const socketHost = new URL(ApiHelper.API_URL).host;
    /**
     * Hook que expone la estructura del árbol de media, archivos importantes y métodos
     * para refrescar/expander directorios. Atiende eventos WebSocket `resource="media"`.
     */
    const { ready, subscribe } = useSocket("/ws/media-updates/", socketHost);

    //Carga el listado de directorios y ficheros del servidor
    const directoriesRef = useRef<DirectoryProps | undefined>(undefined);
    /**
     * Mantiene el ref de directorios sincronizado para poder reutilizar
     * el mismo árbol dentro de callbacks asíncronos sin causar renders.
     */
    useEffect(() => {
        directoriesRef.current = directories;
    }, [directories]);

    /**
     * Carga la estructura completa del árbol, archivos importantes y actualiza hashes.
     * Si el socket ya reporta `ready`, usa la cache para evitar solicitudes duplicadas.
     */
    const loadMedia = useCallback(
        async (options?: { force?: boolean }) => {
            const force = options?.force ?? false;
            setLoading(true);
            setError("");
            try {
                if (ready && directoriesRef.current && !force) {
                    return directoriesRef.current;
                }
                //Carga el arbol de archivos y lo establece
                const entries = await fetchMediaTree();
                const root: DirectoryProps = {
                    name: "media",
                    type: "directory",
                    relativePath: "",
                    children: entries,
                };
                setDirectories(root);
                const important = await fetchImportantFiles();
                setImportantFiles(important);
                if (useVersionPoll) {
                    const version = await fetchMediaTreeVersion();
                    setTreeVersion(version);
                    setMediaHash(version);
                } else {
                    setTreeVersion("");
                    setMediaHash("");
                }
                return root;
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : ErrorMessages.mediaError,
                );
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [ready, useVersionPoll],
    );

    /**
     * Lanza la carga inicial del árbol al montar o cuando cambia `loadMedia`.
     */
    useEffect(() => {
        void loadMedia();
    }, [loadMedia]);
    //Compara versiones periódicamente con el hash, 15000ms de intervalo
    /**
     * Sondea periódicamente la versión del árbol cuando la
     * comparación por hash está activa; evita la recarga si ya se está cargando.
     */
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

    const loadMediaRef = useRef(loadMedia);
    const mediaHashRef = useRef(mediaHash);

    /**
     * Actualiza el ref con la función `loadMedia` más reciente para usarla desde callbacks.
     */
    useEffect(() => {
        loadMediaRef.current = loadMedia;
    }, [loadMedia]);

    /**
     * Guarda el hash actual en un ref para compararlo sin depender del estado.
     */
    useEffect(() => {
        mediaHashRef.current = mediaHash;
    }, [mediaHash]);

    /**
     * Se suscribe al socket de media y fuerza refrescos cuando llegan eventos relevantes.
     */
    useEffect(() => {
        const unsubscribe = subscribe((data) => {
            if (loading) {
                return;
            }
            if (typeof data === "object" && data !== null) {
                const typed = data as {
                    action?: string;
                    resource?: string;
                    hash?: string;
                };
                if (typed.action === "refresh") {
                    if (
                        typed.resource === "media" &&
                        typed.hash &&
                        typed.hash === mediaHashRef.current
                    ) {
                        return;
                    }
                    if (typed.resource === "media" && typed.hash) {
                        setMediaHash(typed.hash);
                    }
                    void loadMediaRef.current?.({ force: true });
                }
            }
        });
        return unsubscribe;
    }, [loading, subscribe]);

    /**
     * Activa la comprobación por hash solo cuando el socket todavía no está listo.
     */
    useEffect(() => {
        setUseVersionPoll(!ready);
    }, [ready]);

    /**
     * Suscribe el polling legado cuando el socket aún no informa estar listo.
     */
    useEffect(() => {
        if (ready) {
            return () => undefined;
        }
        const unsubscribe = subscribeMediaTreeUpdates(() => {
            if (loading) return;
            void loadMedia();
        });
        return unsubscribe;
    }, [loadMedia, loading, ready]);

    /**
     * Alterna la expansión de un directorio conservando la lista de expanders actuales.
     */
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
    /**
     * Devuelve si un directorio está expandido (normaliza la ruta).
     */
    const isDirectoryExpanded = useCallback(
        (relativePath: string) =>
            expandedDirectories.includes(normalizeRelativePath(relativePath)),
        [expandedDirectories],
    );

    /**
     * Fuerza la recarga del árbol solicitando `loadMedia` con `force: true`.
     */
    const refresh = useCallback(async () => {
        await loadMedia({ force: true });
    }, [loadMedia]);

    const value = useMemo(
        () => ({
            directories,
            importantFiles,
            loading,
            error,
            refresh,
            toggleDirectory,
            isDirectoryExpanded,
        }),
        [
            directories,
            importantFiles,
            loading,
            error,
            refresh,
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
