import { afterEach, describe, expect, it } from "vitest";
import { developmentEmployees } from "../../../database/seeds/employeeSeed";
import type { EmployeeInput } from "../../../types/employee";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";

afterEach(() => localStorage.clear());

describe("LocalEmployeeRepository transfers", () => {
  it("closes the former placement and opens a new history entry", async () => {
    const repository = new LocalEmployeeRepository();
    const employee = developmentEmployees[0];
    const omitted = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status", "assignment_history"]);
    const input = Object.fromEntries(
      Object.entries(employee).filter(([key]) => !omitted.has(key)),
    ) as unknown as EmployeeInput;
    const transfer = {
      ...input,
      active_assignment: {
        id: "00000000-0000-4000-8000-000000000099",
        branch_id: "60000000-0000-4000-8000-000000000002",
        client_id: "61000000-0000-4000-8000-000000000002",
        assignment_code: "ASN-TRANSFER",
        start_date: "2026-09-28",
        end_date: null,
        work_location: "General Santos Site",
        transfer_reason: "Operational requirement",
        notes: null,
      },
    };

    const saved = await repository.update(employee.id, transfer);

    expect(saved.active_assignment?.id).toBe(transfer.active_assignment.id);
    expect(saved.assignment_history).toHaveLength(2);
    expect(saved.assignment_history.find((item) => item.id === employee.active_assignment?.id)?.end_date).toBe("2026-09-28");
  });
});

