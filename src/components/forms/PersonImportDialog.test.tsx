import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonImportDialog } from "./PersonImportDialog";
import { branches, clients } from "../../services/lookups/organization";
import { readSpreadsheet } from "../../services/imports/excelWorkbook";
import type { PersonImportRow } from "../../services/imports/personImport";

vi.mock("../../services/imports/excelWorkbook", () => ({ readSpreadsheet: vi.fn() }));
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../services/organization/useOrganization", () => ({ useOrganization: () => ({ branches: [], clients: [], departments: [], positions: [] }) }));
vi.mock("../../services/access/useAccess", () => ({ useAccess: () => ({ can: () => false }) }));
vi.mock("../../services/imports/personImportTemplate", async (importOriginal) => ({ ...await importOriginal<typeof import("../../services/imports/personImportTemplate")>(), downloadPersonImportTemplate: vi.fn() }));

describe("PersonImportDialog", () => {
  it("corrects rows directly while keeping the record ID read-only", async () => {
    vi.mocked(readSpreadsheet).mockResolvedValue([{ ID: "2", "FIRST NAME": "Alpha", "LAST NAME": "Test", MOBILE: "123" }, { ID: "1", "FIRST NAME": "Beta", "LAST NAME": "Test", MOBILE: "09171234567" }]);
    render(<PersonImportDialog kind="employee" branches={[branches[1]]} clients={[clients[0]]} linkOptions={[]} importing={false} onClose={vi.fn()} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Excel workbook"), { target: { files: [new File(["test"], "employees.xlsx")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit import row 2" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Edit import row 2" }));
    fireEvent.change(screen.getByLabelText("Filter imported fields", { selector: "select" }), { target: { value: "contact" } });
    expect(screen.getByLabelText("MOBILE")).toBeInTheDocument();
    expect(screen.queryByLabelText("FIRST NAME")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("MOBILE"), { target: { value: "09181234567" } });
    fireEvent.change(screen.getByLabelText("Filter imported fields", { selector: "select" }), { target: { value: "all" } });
    expect(screen.getByLabelText("ID")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 2 ready" })).toBeEnabled());
    expect(screen.queryByText("ID is duplicated in this workbook.")).not.toBeInTheDocument();
    expect(screen.getByText("000002")).toBeInTheDocument();
  });
  it("requires deployment confirmation and auto-assigns a sole permitted branch/client", () => {
    render(<PersonImportDialog kind="employee" branches={[branches[1]]} clients={[clients[0]]} linkOptions={[]} importing={false} onClose={vi.fn()} onImport={vi.fn()} requireClient />);
    expect(screen.getByLabelText("Branch", { selector: "select" })).toHaveValue(branches[1].id);
    expect(screen.getByLabelText("Client", { selector: "select" })).toHaveValue(clients[0].id);
    expect(screen.getByLabelText("Branch", { selector: "select" })).toBeDisabled();
    expect(screen.queryByLabelText("Excel workbook")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Excel workbook")).toBeInTheDocument();
  });
  it("paginates validation, filters by error type and retains successful results without resubmitting", async () => {
    vi.mocked(readSpreadsheet).mockResolvedValue(Array.from({ length: 13 }, (_, index) => ({ "FIRST NAME": `Person ${index}`, "LAST NAME": "Test", MOBILE: index === 12 ? "123" : "", "BIRTH DATE": index === 11 ? "2026-02-30" : "" })));
    const onImport = vi.fn(async (rows: PersonImportRow[]) => rows.map((row) => ({ rowNumber: row.rowNumber, status: "imported" as const, message: `Imported ${row.rowNumber}` })));
    render(<PersonImportDialog kind="employee" branches={[branches[1]]} clients={[clients[0]]} linkOptions={[]} importing={false} onClose={vi.fn()} onImport={onImport} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Excel workbook"), { target: { files: [new File(["test"], "employees.xlsx")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 11 ready" })).toBeEnabled());
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Error type", { selector: "select" }), { target: { value: "date" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText(/BIRTH DATE: enter/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Error type", { selector: "select" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Import 11 ready" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 0 ready" })).toBeDisabled());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith(expect.any(Array), branches[1].id, clients[0].id, expect.any(Function));
    fireEvent.click(screen.getByRole("button", { name: /Imported$/ }));
    expect(screen.getByText("Imported 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Link row 2")).toBeDisabled();
  });
});
