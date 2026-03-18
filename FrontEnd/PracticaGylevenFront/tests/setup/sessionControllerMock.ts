import { vi } from "vitest";

export const loginMock = vi.fn();
export const logoutMock = vi.fn();
export const whoamiMock = vi.fn();
export const getUsernameMock = vi.fn().mockResolvedValue("tester");

vi.mock("../../app/session/SessionController", () => ({
    login: (...args: Parameters<typeof loginMock>) =>
        loginMock(...args),
    loginGoogle: vi.fn(),
    logout: (...args: Parameters<typeof logoutMock>) =>
        logoutMock(...args),
    whoami: (...args: Parameters<typeof whoamiMock>) =>
        whoamiMock(...args),
    get_username: (...args: Parameters<typeof getUsernameMock>) =>
        getUsernameMock(...args),
}));
