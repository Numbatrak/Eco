import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth, RequireGuest } from "./RouteGuards";
import { useAuth, type AuthStatus } from "../context/AuthContext";

vi.mock("../context/AuthContext", async () => {
  const actual =
    await vi.importActual<typeof import("../context/AuthContext")>("../context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});

const mockedUseAuth = vi.mocked(useAuth);

function renderGuard(status: AuthStatus, Guard: typeof RequireAuth | typeof RequireGuest) {
  mockedUseAuth.mockReturnValue({ status } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route element={<Guard />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("redirects unauthenticated users to /login", () => {
    renderGuard("unauthenticated", RequireAuth);
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected route for authenticated users", () => {
    renderGuard("authenticated", RequireAuth);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows a loading state instead of redirecting while the silent refresh is pending", () => {
    renderGuard("loading", RequireAuth);
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});

describe("RequireGuest", () => {
  it("redirects authenticated users to /dashboard", () => {
    renderGuard("authenticated", RequireGuest);
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("renders the guest route for unauthenticated users", () => {
    renderGuard("unauthenticated", RequireGuest);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
