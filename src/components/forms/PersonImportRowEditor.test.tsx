import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./unsavedChanges";
import { UnsavedChangesProvider } from "./UnsavedChangesProvider";
import { PersonImportRowEditor } from "./PersonImportRowEditor";
import { personRowsFromSpreadsheet } from "../../services/imports/personImport";
vi.mock("../../services/organization/useOrganization", () => ({ useOrganization: () => ({ branches: [], clients: [], departments: [], positions: [] }) }));
vi.mock("../../services/access/useAccess", () => ({ useAccess: () => ({ can: () => false }) }));

describe("import row editor", () => {
  it("only confirms discarding the edited row, not its parent workbook", async () => {
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Alpha", "LAST NAME": "Test" }]);
    const close = vi.fn();
    function Parent() {
      useUnsavedChanges(true);
      return <PersonImportRowEditor row={row} kind="employee" onSave={vi.fn()} onClose={close} />;
    }
    const router = createMemoryRouter([{ path: "/", element: <UnsavedChangesProvider><Parent /></UnsavedChangesProvider> }]);
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("FIRST NAME"), { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});
