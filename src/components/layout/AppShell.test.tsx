import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
vi.mock("../../services/access/useAccess", () => ({ useAccess: () => ({ profile: { userId: "qa", displayName: "QA", role: "super_admin" }, can: () => true }) }));
vi.mock("../../services/auth/useAuth", () => ({ useAuth: () => ({ session: { mode: "offline" }, signOut: vi.fn() }) }));
describe("collapsible desktop navigation", () => {
  it("changes sidebar width without unmounting the current page or its draft", () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppShell><label>Draft<input aria-label="Draft" defaultValue="Keep me" /></label></AppShell></MemoryRouter></QueryClientProvider>);
    const sidebar = document.getElementById("desktop-sidebar")!;
    expect(sidebar).toHaveClass("lg:block");
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "Unsaved attendance" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(sidebar).not.toHaveClass("lg:block");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Draft")).toHaveValue("Unsaved attendance");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(sidebar).toHaveClass("lg:block");
    expect(screen.getByLabelText("Draft")).toHaveValue("Unsaved attendance");
  });
});
