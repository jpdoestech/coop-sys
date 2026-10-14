import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceMatrix } from "./AttendanceMatrix";
import { matrixTestRun, matrixTestSource } from "./attendanceMatrixTestData";
import { AccessContextValue } from "../../services/access/accessContextValue";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import type { AttendanceRecord } from "../../types/attendance";

vi.mock("../../utils/env", () => ({ getAppMode: () => "OFFLINE" }));
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => localStorage.clear());
function setup() {
  const run = { ...matrixTestRun, period_end: "2026-10-03" }, source = matrixTestSource(run);
  const save = vi.fn().mockResolvedValue(undefined);
  const preview = vi.fn().mockResolvedValue(source);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function mount() { render(<QueryClientProvider client={client}><AccessContextValue.Provider value={{ userId: "70000000-0000-4000-8000-000000000001", displayName: "QA", role: "super_admin", branchIds: [], scopeType: "organization" }}><AttendanceMatrix run={run} repository={{ previewSource: preview } as unknown as PayrollRunRepository} attendance={{ saveCutoffBatch: save } as unknown as AttendanceRepository} /></AccessContextValue.Provider></QueryClientProvider>); }
  return { run, source, save, preview, mount };
}
const cell = (employee: number, date: string) => screen.getByRole("button", { name: new RegExp(`QA, Employee ${employee} ${date}:`) });
describe("lightweight cutoff matrix", () => {
  it("keeps blanks unsaved and confirms defaults without overwriting approved or explicitly absent dates", async () => {
    const { mount, source, save, run } = setup();
    source.rows[0].attendance = { id: "approved", status: "present", review_status: "approved", segments: source.rows[0].terms!.data.duty_segments!, terms_id: source.rows[0].terms!.id } as AttendanceRecord;
    mount(); await waitFor(() => expect(cell(1, "2026-10-02")).toBeEnabled());
    expect(save).not.toHaveBeenCalled(); expect(cell(1, "2026-10-01")).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Absent" })); fireEvent.click(cell(1, "2026-10-02"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm page defaults" }));
    expect(cell(1, "2026-10-02")).toHaveTextContent("ABSENT");
    fireEvent.change(screen.getByLabelText("Cutoff DTR reference"), { target: { value: "Manual DTR" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const inputs = save.mock.calls[0][1]; expect(save.mock.calls[0][0]).toBe(run.id);
    expect(inputs).toHaveLength(5); expect(inputs.filter((r: { status: string }) => r.status === "absent")).toHaveLength(1);
  });
  it("applies quick-menu transactions, undo and redo without saving automatically", async () => {
    const { mount, save } = setup(); mount(); await waitFor(() => expect(cell(1, "2026-10-01")).toBeEnabled());
    fireEvent.contextMenu(cell(1, "2026-10-01"), { clientX: 20, clientY: 20 });
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "AWOL / AWOP" }));
    expect(cell(1, "2026-10-01")).toHaveTextContent("AWOL/P");
    fireEvent.click(screen.getByRole("button", { name: "Undo attendance changes" })); expect(cell(1, "2026-10-01")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Redo attendance changes" })); expect(cell(1, "2026-10-01")).toHaveTextContent("AWOL/P");
    expect(save).not.toHaveBeenCalled();
  });
  it("adjusts the second duty's actual time and shows late minutes directly in the grid", async () => {
    const { mount, save } = setup(); mount(); await waitFor(() => expect(cell(1, "2026-10-01")).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: "Late / Undertime" })); fireEvent.click(cell(1, "2026-10-01"));
    fireEvent.input(screen.getByLabelText("Duty 2 actual time in"), { target: { value: "13:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply to day" }));
    expect(cell(1, "2026-10-01")).toHaveTextContent("L 30m"); expect(save).not.toHaveBeenCalled();
  });
  it("uses an account's absent-default preference only after explicit confirmation", async () => {
    localStorage.setItem("coop_sys_attendance_preferences:70000000-0000-4000-8000-000000000001", JSON.stringify({ blank_mode: "absent" }));
    const { mount, save } = setup(); mount(); await waitFor(() => expect(cell(1, "2026-10-01")).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: "Present" })); fireEvent.click(cell(1, "2026-10-01"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm page defaults" }));
    fireEvent.change(screen.getByLabelText("Cutoff DTR reference"), { target: { value: "Reviewed DTR" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1].filter((r: { status: string }) => r.status === "absent")).toHaveLength(5);
  });
});
