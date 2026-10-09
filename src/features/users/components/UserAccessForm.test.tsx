import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultRoles } from "../../../services/access/accessControl";
import { branches } from "../../../services/lookups/organization";
import type { SystemUser } from "../../../types/systemUser";
import { UserAccessForm } from "./UserAccessForm";

function setup() {
  const onSubmit = vi.fn();
  const view = render(<UserAccessForm user={null} roles={createDefaultRoles()} users={[]} employees={[]} saving={false} offline={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Test user" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "test@example.test" } });
  return { ...view, onSubmit };
}

describe("UserAccessForm steps", () => {
  it("does not save when Next replaces itself with Save user", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText(branches[0].label));
    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.click(next);
    const save = screen.getByRole("button", { name: "Save user" });
    expect(save).not.toBe(next);
    expect(save).toHaveAttribute("type", "submit");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ branch_ids: [branches[0].id] }));
  });

  it("advances early-step submissions without saving and validates scope", () => {
    const { container, onSubmit } = setup();
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    expect(screen.getByLabelText("Data scope", { selector: "select" })).toBeInTheDocument();
    fireEvent.submit(form);
    expect(screen.getByText("Assign at least one branch.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(branches[0].label));
    fireEvent.submit(form);
    expect(screen.getByRole("button", { name: "Save user" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows Super Admin account details to be saved while access controls stay locked", () => {
    const roles = createDefaultRoles();
    const superAdminRole = roles.find((role) => role.code === "super_admin")!;
    const user: SystemUser = {
      id: "user-1",
      display_name: "System Administrator",
      email: "admin@example.test",
      role: "super_admin",
      role_ids: [superAdminRole.id],
      branch_ids: [],
      client_ids: [],
      direct_grants: [],
      direct_denies: [],
      scope_type: "organization",
      resource_assignments: [],
      linked_employee_id: null,
      manager_user_id: null,
      is_active: true,
      created_at: "2026-10-09T00:00:00.000Z",
      updated_at: "2026-10-09T00:00:00.000Z",
    };
    const onSubmit = vi.fn();
    render(<UserAccessForm user={user} roles={roles} users={[]} employees={[]} saving={false} offline onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Updated Admin" } });
    expect(screen.getByRole("checkbox", { name: /Super Admin/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Save user" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      display_name: "Updated Admin",
      role: "super_admin",
      role_ids: [superAdminRole.id],
    }));
  });
});
