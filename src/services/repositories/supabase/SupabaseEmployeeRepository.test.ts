import { beforeEach, describe, expect, it, vi } from "vitest";
import { developmentEmployees } from "../../../database/seeds/employeeSeed";
import { SupabaseEmployeeRepository } from "./SupabaseEmployeeRepository";

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../database/supabase/client", () => ({ supabase: db }));

beforeEach(() => vi.resetAllMocks());

describe("SupabaseEmployeeRepository transfer and placement reads", () => {
  it("creates the employee and its initial deployment through one atomic RPC", async () => {
    const repository = new SupabaseEmployeeRepository(), employee = developmentEmployees[0];
    const input = { ...employee, beneficiaries: [] };
    db.rpc.mockResolvedValue({ error: null, data: employee.id });
    db.from.mockReturnValue({ delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.spyOn(repository, "getById").mockResolvedValue(employee);
    await repository.create(input);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("create_employee_with_assignment", {
      p_employee: expect.objectContaining({ employee_number: employee.employee_number, member_id: employee.member_id }),
      p_assignment: employee.active_assignment,
    });
    const payload = db.rpc.mock.calls[0][1].p_employee;
    expect(payload).not.toHaveProperty("active_assignment");
    expect(payload).not.toHaveProperty("beneficiaries");
  });
  it("filters by current placement while preserving full assignment history", async () => {
    const employee = developmentEmployees[1];
    const historical = { ...employee.active_assignment!, end_date: "2026-10-05" };
    const current = { ...historical, id: "new-assignment", branch_id: "head-office", client_id: null, start_date: "2026-10-05", end_date: null };
    const deleted = { ...current, id: "deleted-assignment", start_date: "2026-10-06", deleted_at: "2026-10-06T00:00:00Z" };
    const query = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [{ ...employee, employment_assignments: [historical, current, deleted] }], error: null, count: 1 }),
    };
    db.from.mockReturnValue(query);

    const page = await new SupabaseEmployeeRepository().listPage({ branchId: "head-office", limit: 10 });

    expect(query.select.mock.calls[0][0]).toContain("employment_assignments(*), current_placement:employment_assignments!inner(id)");
    expect(query.eq).toHaveBeenCalledWith("current_placement.branch_id", "head-office");
    expect(query.is).toHaveBeenCalledWith("current_placement.end_date", null);
    expect(query.is).toHaveBeenCalledWith("current_placement.deleted_at", null);
    expect(page.items[0].active_assignment?.id).toBe(current.id);
    expect(page.items[0].assignment_history).toHaveLength(2);
    expect(page.total).toBe(1);
  });

  it("uses one RPC for closing, opening, and synchronizing a member-originated transfer", async () => {
    const repository = new SupabaseEmployeeRepository();
    const employee = developmentEmployees[0];
    db.rpc.mockResolvedValue({ error: null, data: "new-assignment" });
    vi.spyOn(repository, "getById").mockResolvedValue(employee);

    await repository.transfer(employee.id, employee.active_assignment!, "member");

    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("transfer_employee", {
      p_employee_id: employee.id,
      p_assignment: employee.active_assignment,
      p_source: "member",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("surfaces rejected transfers without issuing separate placement writes", async () => {
    db.rpc.mockResolvedValue({ error: new Error("The destination branch is outside your assigned scope.") });
    const employee = developmentEmployees[0];
    await expect(new SupabaseEmployeeRepository().transfer(employee.id, employee.active_assignment!)).rejects.toThrow("outside your assigned scope");
    expect(db.from).not.toHaveBeenCalled();
  });
});
