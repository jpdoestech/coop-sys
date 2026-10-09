import { beforeEach, expect, it, vi } from "vitest";
import { SupabaseEmployeeRepository } from "./SupabaseEmployeeRepository";
import { SupabaseMemberRepository } from "./SupabaseMemberRepository";
import { personSearchFilter } from "../../identity/personSearch";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../../database/supabase/client", () => ({ supabase: db }));
beforeEach(() => vi.resetAllMocks());

it.each([
  ["employee", "employee_number", new SupabaseEmployeeRepository()],
  ["member", "membership_number", new SupabaseMemberRepository()],
] as const)("supports comma-separated %s names in both list methods", async (_kind, numberColumn, repository) => {
  const query = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
  };
  db.from.mockReturnValue(query);
  const options = { search: "Dela Cruz, Juan" };
  await repository.list(options);
  await repository.listPage(options);
  expect(query.or).toHaveBeenCalledTimes(2);
  expect(query.or).toHaveBeenNthCalledWith(1, personSearchFilter(options.search, numberColumn));
  expect(query.or).toHaveBeenNthCalledWith(2, personSearchFilter(options.search, numberColumn));
});
