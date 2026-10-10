import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "../forms/UnsavedChangesProvider";
import { useUnsavedChanges } from "../forms/unsavedChanges";
import { WorkspaceBreadcrumbs, WorkspaceNavigationProvider, useWorkspaceDialog, useWorkspacePath } from "./WorkspaceNavigation";

const NativeRequest = globalThis.Request;
beforeEach(() => vi.stubGlobal("Request", class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
}));
afterEach(() => vi.unstubAllGlobals());

function Editor({ onClose }: { onClose: () => void }) {
  useWorkspaceDialog("Edit Member", onClose);
  const [name, setName] = useState("");
  const [nested, setNested] = useState(false);
  useUnsavedChanges(Boolean(name));
  return <section role="dialog"><WorkspaceBreadcrumbs dialog /><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><button onClick={() => setNested(true)}>Open child</button>{nested ? <Child onClose={() => setNested(false)} /> : null}</section>;
}
function Child({ onClose }: { onClose: () => void }) {
  useWorkspaceDialog("Import Aliases", onClose);
  return <section aria-label="Child dialog" role="dialog"><WorkspaceBreadcrumbs dialog /></section>;
}
function Members() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Edit</button>{open ? <Editor onClose={() => setOpen(false)} /> : null}</>;
}
function Payments() {
  const [tab, setTab] = useState("Payment Summary");
  useWorkspacePath([{ label: "Payments", onSelect: () => setTab("Transactions") }, { label: tab }]);
  return <button onClick={() => setTab("Manual Payment")}>Manual</button>;
}
function setup(path = "/members") {
  const router = createMemoryRouter([{ element: <UnsavedChangesProvider><WorkspaceNavigationProvider><WorkspaceBreadcrumbs /><Outlet /></WorkspaceNavigationProvider></UnsavedChangesProvider>, children: [
    { path: "/members", element: <Members /> }, { path: "/payments", element: <Payments /> }, { path: "/reports", element: <p>Reports</p> },
  ] }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
const header = () => within(screen.getByRole("navigation", { name: "Workspace breadcrumb" }));

describe("workspace directory", () => {
  it("tracks active tabs and returns to the section's default view", () => {
    setup("/payments");
    expect(header().getByText("Payment Summary")).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByText("Manual"));
    expect(header().getByText("Manual Payment")).toBeInTheDocument();
    fireEvent.click(header().getByRole("button", { name: "Payments" }));
    expect(header().getByText("Transactions")).toBeInTheDocument();
  });
  it("shows a modal path and closes the editor through its parent", () => {
    setup(); fireEvent.click(screen.getByText("Edit"));
    expect(header().getByText("Edit Member")).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Dialog breadcrumb" })).getByRole("button", { name: "Members" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(header().getByText("Members")).toHaveAttribute("aria-current", "page");
  });
  it("keeps unsaved edits until the user confirms leaving", () => {
    setup(); fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Juan" } });
    fireEvent.click(header().getByRole("button", { name: "Members" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Juan");
    fireEvent.click(header().getByRole("button", { name: "Members" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
  it("returns from a nested dialog without closing its parent", () => {
    setup(); fireEvent.click(screen.getByText("Edit")); fireEvent.click(screen.getByText("Open child"));
    expect(header().getByText("Import Aliases")).toBeInTheDocument();
    fireEvent.click(header().getByRole("button", { name: "Edit Member" }));
    expect(screen.queryByRole("dialog", { name: "Child dialog" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    fireEvent.click(header().getByRole("button", { name: "Members" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("removes stale tab labels on navigation", async () => {
    const router = setup("/payments");
    await act(() => router.navigate("/reports"));
    expect(header().getByText("Reports")).toHaveAttribute("aria-current", "page");
    expect(header().queryByText("Payment Summary")).not.toBeInTheDocument();
  });
});
