import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
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
    const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
    const [directories, setDirectories] = useState<DirectoryProps>();
    const [importantFiles, setImportantFiles] = useState<ImportantFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [treeVersion, setTreeVersion] = useState("");

    const loadMedia = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
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
            const version = await fetchMediaTreeVersion();
            setTreeVersion(version);
        } catch (err) {
            setError(err instanceof Error ? err.message : ErrorMessages.mediaError);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMedia();
    }, [loadMedia]);

    useEffect(() => {
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
    }, [loading, loadMedia, treeVersion]);

    useEffect(() => {
        const unsubscribe = subscribeMediaTreeUpdates(() => {
            if (loading) {
                return;
            }
            void loadMedia();
        });
        return unsubscribe;
    }, [loading, loadMedia]);

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

    const isDirectoryExpanded = useCallback(
        (relativePath: string) =>
            expandedDirectories.includes(
                normalizeRelativePath(relativePath),
            ),
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
