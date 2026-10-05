import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonImportDialog } from "./PersonImportDialog";
import { branches, clients } from "../../services/lookups/organization";
import { readSpreadsheet } from "../../services/imports/excelWorkbook";
import type { PersonImportRow } from "../../services/imports/personImport";

vi.mock("../../services/imports/excelWorkbook", () => ({ readSpreadsheet: vi.fn() }));
vi.mock("../../services/imports/personImportTemplate", () => ({ downloadPersonImportTemplate: vi.fn() }));

describe("PersonImportDialog", () => {
  it("requires deployment confirmation and auto-assigns a sole permitted branch/client", () => {
    render(<PersonImportDialog kind="employee" branches={[branches[1]]} clients={[clients[0]]} linkOptions={[]} importing={false} onClose={vi.fn()} onImport={vi.fn()} requireClient />);
    expect(screen.getByLabelText("Branch")).toHaveValue(branches[1].id);
    expect(screen.getByLabelText("Client")).toHaveValue(clients[0].id);
    expect(screen.getByLabelText("Branch")).toBeDisabled();
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
    fireEvent.change(screen.getByLabelText("Error type"), { target: { value: "date" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText(/BIRTH DATE: enter/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Error type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Import 11 ready" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 0 ready" })).toBeDisabled());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith(expect.any(Array), branches[1].id, clients[0].id);
    fireEvent.click(screen.getByRole("button", { name: /Imported$/ }));
    expect(screen.getByText("Imported 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Link row 2")).toBeDisabled();
  });
});
