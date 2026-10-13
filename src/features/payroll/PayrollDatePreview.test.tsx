import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { PayrollDatePreview } from "./PayrollDatePreview";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";

vi.mock("../../services/repositories/repositoryFactory", () => ({ createRepositories: () => ({ employees: { listPage: async () => ({ items: [{ id: "e1", employee_number: "000001", first_name: "Juan", last_name: "Dela Cruz" }] }), getById: async () => ({ member_id: "m1" }) } }) }));
it("reloads applicable terms when a date input event changes the work date", async () => {
  const load = vi.fn().mockResolvedValue([]);
  const repository = { workDateRecords: load } as unknown as PayrollRepository;
  render(<QueryClientProvider client={new QueryClient()}><PayrollDatePreview repository={repository} onClose={vi.fn()} /></QueryClientProvider>);
  fireEvent.focus(screen.getByRole("combobox", { name: "Employee" }));
  fireEvent.click(await screen.findByRole("option", { name: "000001 - Dela Cruz, Juan" }));
  await waitFor(() => expect(load).toHaveBeenCalled());
  fireEvent.input(screen.getByLabelText("Work date"), { target: { value: "2026-10-01" } });
  await waitFor(() => expect(load).toHaveBeenLastCalledWith("e1", "2026-10-01"));
  expect(screen.getByText("₱50.00")).toBeInTheDocument();
});
