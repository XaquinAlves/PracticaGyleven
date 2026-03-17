import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ErrorMessages } from "../app/common/messageCatalog";
import { MediaViewContent } from "../app/media/MediaView";
import { InvoicesViewContent } from "../app/imports/invoices/InvoicesView";

const mockUseMedia = vi.fn();
const mockUseInvoices = vi.fn();

vi.mock("~/media/useMedia", () => ({
    useMedia: () => mockUseMedia(),
}));

vi.mock("~/imports/invoices/useInvoices", () => ({
    useInvoices: () => mockUseInvoices(),
}));

describe("view messaging", () => {
    beforeEach(() => {
        mockUseMedia.mockReset();
        mockUseInvoices.mockReset();
    });

    it("prefers the error message when media hook reports error", () => {
        mockUseMedia.mockReturnValue({
            directories: undefined,
            importantFiles: [],
            loading: false,
            error: "boom",
            refresh: vi.fn(),
        });

        render(
            <MemoryRouter>
                <MediaViewContent />
            </MemoryRouter>,
        );

        expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });

    it("shows empty media placeholder when no directories", () => {
        mockUseMedia.mockReturnValue({
            directories: undefined,
            importantFiles: [],
            loading: false,
            error: "",
            refresh: vi.fn(),
        });

        render(
            <MemoryRouter>
                <MediaViewContent />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(ErrorMessages.mediaEmpty),
        ).toBeInTheDocument();
    });

    it("shows invoices empty message when the hook yields no entries", () => {
        mockUseInvoices.mockReturnValue({
            invoices: [],
            loading: false,
            error: "",
            refresh: vi.fn(),
        });

        render(
            <MemoryRouter>
                <InvoicesViewContent />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(ErrorMessages.invoicesEmpty),
        ).toBeInTheDocument();
    });
});
