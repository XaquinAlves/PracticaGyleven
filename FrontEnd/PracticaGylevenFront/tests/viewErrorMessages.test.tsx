import "./setup/sessionControllerMock";
import "@testing-library/jest-dom";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../app/session/Login";
import Inicio from "../app/Inicio";
import { NeosViewContent } from "../app/neos/NeosView";
import { MediaViewContent } from "../app/media/MediaView";
import {
    ImportantFilesViewContent,
} from "../app/media/ImportantFilesView";
import { InvoicesViewContent } from "../app/imports/invoices/InvoicesView";
import {
    loginMock,
    logoutMock,
    whoamiMock,
    getUsernameMock,
} from "./setup/sessionControllerMock";

const useMediaMock = vi.fn();
const resetMediaHook = () => ({
    directories: undefined,
    importantFiles: [],
    loading: false,
    error: "",
    refresh: vi.fn(),
});
vi.mock("../app/media/useMedia", () => ({
    MediaProvider: ({ children }: { children: ReactElement }) => children,
    useMedia: () => useMediaMock(),
}));

const useInvoicesMock = vi.fn();
vi.mock("../app/imports/invoices/useInvoices", () => ({
    InvoicesProvider: ({ children }: { children: ReactElement }) => children,
    useInvoices: () => useInvoicesMock(),
}));

const renderWithRouter = (ui: ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

describe("view error messaging", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginMock.mockReset();
        loginMock.mockResolvedValue(undefined);
        logoutMock.mockReset();
        logoutMock.mockResolvedValue(undefined);
        whoamiMock.mockReset();
        whoamiMock.mockResolvedValue(undefined);
        getUsernameMock.mockReset();
        getUsernameMock.mockResolvedValue("tester");
        useMediaMock.mockReset();
        useMediaMock.mockReturnValue(resetMediaHook());
        useInvoicesMock.mockReset();
        useInvoicesMock.mockReturnValue({
            invoices: [],
            loading: false,
            error: "",
            refresh: vi.fn(),
        });
    });

    it("Login surfaces the backend error text", async () => {
        loginMock.mockRejectedValueOnce(new Error("Credenciales inválidas"));
        renderWithRouter(<Login />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/nombre de usuario/i), "test");
        await user.type(screen.getByLabelText(/contraseña/i), "secret");
        await user.click(screen.getByRole("button", { name: /iniciar sesi/i }));
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Credenciales inválidas",
            );
        });
    });

    it("Inicio shows the logout error message", async () => {
        logoutMock.mockRejectedValueOnce(new Error("No se pudo cerrar sesión"));
        renderWithRouter(<Inicio />);
        const user = userEvent.setup();
        const closeButtons = screen.getAllByRole("button", {
            name: /cerrar sesi(?:ó|o)n/i,
        });
        await user.click(closeButtons[closeButtons.length - 1]);
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "No se pudo cerrar sesión",
            );
        });
    });

    it("NeosViewContent renders the Neos error text", async () => {
        const refreshMock = vi.fn();
        renderWithRouter(
            <NeosViewContent
                useNeosHook={() => ({
                    neos: undefined,
                    loading: false,
                    error: "No se pudo cargar los NEOs",
                    page: 1,
                    setPage: vi.fn(),
                    refresh: refreshMock,
                    saveToDatabase: vi.fn(),
                })}
            />,
        );
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "No se pudo cargar los NEOs",
            );
        });
        await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
        expect(refreshMock).toHaveBeenCalled();
    });

    it("MediaViewContent keeps showing the provider error", async () => {
        const refreshMock = vi.fn();
        useMediaMock.mockReturnValueOnce({
            ...resetMediaHook(),
            error: "No se pudo leer la estructura",
            refresh: refreshMock,
        });
        renderWithRouter(<MediaViewContent />);
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "No se pudo leer la estructura",
            );
        });
        await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
        expect(refreshMock).toHaveBeenCalled();
    });

    it("ImportantFilesViewContent exposes the media error alert", async () => {
        const refreshMock = vi.fn();
        useMediaMock.mockReturnValueOnce({
            ...resetMediaHook(),
            error: "Listado de archivos fallido",
            refresh: refreshMock,
        });
        renderWithRouter(<ImportantFilesViewContent />);
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Listado de archivos fallido",
            );
        });
        fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
        expect(refreshMock).toHaveBeenCalled();
    });

    it("InvoicesViewContent renders the invoices error message", async () => {
        const refreshMock = vi.fn();
        useInvoicesMock.mockReturnValueOnce({
            invoices: [],
            loading: false,
            error: "No se pudieron cargar las facturas",
            refresh: refreshMock,
        });
        renderWithRouter(<InvoicesViewContent />);
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "No se pudieron cargar las facturas",
            );
        });
        fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
        expect(refreshMock).toHaveBeenCalled();
    });
});
