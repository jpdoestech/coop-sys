import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "./UnsavedChangesProvider";
import { useConfirmation, useUnsavedChanges } from "./unsavedChanges";

const NativeRequest = globalThis.Request;
beforeEach(() => {
  // Node's Request cannot consume jsdom's AbortSignal; these tests have no loaders to abort.
  vi.stubGlobal("Request", class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
  });
});
afterEach(() => vi.unstubAllGlobals());

function Editor() {
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const { confirmLeave } = useUnsavedChanges(open && value !== baseline, busy);
  const confirm = useConfirmation();
  return <>
    <Link to="/other">Other page</Link>
    {open ? <><label>Name<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
      <button onClick={() => confirmLeave(() => setOpen(false))}>Close editor</button>
      <button onClick={() => setBaseline(value)}>Save successfully</button>
      <button onClick={() => setBusy(true)}>Start saving</button>
      <button onClick={() => setBusy(false)}>Save failed</button>
    </> : <p>Editor closed</p>}
    <button onClick={() => confirm("Archive this record?", () => setOpen(false), "Archive record", "Archive")}>Archive record</button>
  </>;
}

function setup(entries = ["/edit"]) {
  const router = createMemoryRouter([{ element: <UnsavedChangesProvider><Outlet /></UnsavedChangesProvider>, children: [
    { path: "/edit", element: <Editor /> }, { path: "/other", element: <p>Other workspace</p> },
  ] }], { initialEntries: entries });
  render(<RouterProvider router={router} />);
  return router;
}

describe("unsaved changes confirmations", () => {
  it("closes unchanged forms without prompting", () => {
    setup(); fireEvent.click(screen.getByText("Close editor"));
    expect(screen.getByText("Editor closed")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("keeps drafts when cancelled and discards only after explicit confirmation", () => {
    setup(); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByText("Close editor"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Draft");
    fireEvent.click(screen.getByText("Close editor"));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByText("Editor closed")).toBeInTheDocument();
  });
  it("blocks route changes and browser back, then resumes the chosen destination", async () => {
    const router = setup(["/other", "/edit"]);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("link", { name: "Other page" }));
    await screen.findByRole("alertdialog");
    expect(router.state.location.pathname).toBe("/edit");
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await act(() => router.navigate(-1));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
  });
  it("does not warn after saving or reverting, and protects refresh only while dirty", () => {
    setup(); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByText("Save successfully"));
    const cleanEvent = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByText("Close editor"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("does not allow discarding during an in-flight save and retains a failed draft", () => {
    setup(); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByText("Start saving")); fireEvent.click(screen.getByText("Close editor"));
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    fireEvent.click(screen.getByText("Save failed")); fireEvent.click(screen.getByText("Close editor"));
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled();
  });
  it("cancels explicit destructive actions using Escape", () => {
    setup(); fireEvent.click(screen.getByText("Archive record"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Archive record"));
    fireEvent.click(screen.getByRole("button", { name: /^Archive$/ }));
    expect(screen.getByText("Editor closed")).toBeInTheDocument();
  });
});
