import { developmentUsers } from "../../../database/seeds/userSeed";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type { AccessRoleInput, UserAccessRepository, UserListOptions } from "../UserAccessRepository";
import { branches, HEAD_OFFICE_ID } from "../../lookups/organization";
import { createDefaultRoles, type AccessRole } from "../../access/accessControl";
import { ACCESS_ROLES_STORAGE_KEY, defaultRoleId, normalizeSystemUser } from "../../access/userAccessModel";
import { setLocalCredential } from "../../auth/local/localCredentialStore";
import { createUuid } from "../../../utils/createUuid";

const STORAGE_KEY = "coop_sys_user_access";

function writeUsers(users: SystemUser[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); }
function readUsers(): SystemUser[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { const users = (JSON.parse(raw) as SystemUser[]).map(normalizeSystemUser); writeUsers(users); return users; }
  writeUsers(developmentUsers); return developmentUsers;
}
function writeRoles(roles: AccessRole[]) { localStorage.setItem(ACCESS_ROLES_STORAGE_KEY, JSON.stringify(roles)); }
function readRoles(): AccessRole[] {
  const raw = localStorage.getItem(ACCESS_ROLES_STORAGE_KEY);
  if (raw) return JSON.parse(raw) as AccessRole[];
  const roles = createDefaultRoles(); writeRoles(roles); return roles;
}
function validateInput(input: SystemUserInput) {
  const roles = readRoles();
  if (!input.role_ids.length || input.role_ids.some((id) => !roles.some((role) => role.id === id && role.is_active))) throw new Error("Assign at least one active system role.");
  if (input.scope_type === "assigned_branches" && input.branch_ids.length === 0) throw new Error("Assign at least one branch for this access scope.");
  if (input.scope_type === "assigned_clients" && input.client_ids.length === 0) throw new Error("Assign at least one client for this access scope.");
  if (input.scope_type === "self" && !input.linked_employee_id) throw new Error("Link an employee for self-only access.");
  const validBranchIds = new Set(branches.filter((branch) => branch.id !== HEAD_OFFICE_ID).map((branch) => branch.id));
  if (input.branch_ids.some((id) => !validBranchIds.has(id))) throw new Error("One or more assigned branches are invalid.");
}
function primaryRole(input: SystemUserInput) { return readRoles().find((role) => role.id === input.role_ids[0])?.code ?? input.role ?? "branch_user"; }

export class LocalUserAccessRepository implements UserAccessRepository {
  async listPage(options: UserListOptions = {}) {
    const term = options.search?.trim().toLowerCase() ?? "";
    const records = readUsers().filter((user) => !term || `${user.display_name} ${user.email}`.toLowerCase().includes(term)).filter((user) => options.status === "all" || !options.status || user.is_active === (options.status === "active")).sort((a, b) => a.display_name.localeCompare(b.display_name));
    const offset = options.offset ?? 0;
    return { items: records.slice(offset, options.limit ? offset + options.limit : undefined), total: records.length };
  }
  async create(input: SystemUserInput) {
    validateInput(input);
    if (!input.temporary_password || input.temporary_password.length < 12) throw new Error("A temporary password of at least 12 characters is required.");
    const users = readUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Email address already belongs to a system user.");
    const timestamp = new Date().toISOString(); const { temporary_password, ...profileInput } = input;
    const user = normalizeSystemUser({ ...profileInput, role: primaryRole(input), id: createUuid(), created_at: timestamp, updated_at: timestamp });
    writeUsers([...users, user]); await setLocalCredential(user.id, temporary_password, true); return user;
  }
  async update(id: string, input: SystemUserInput) {
    validateInput(input);
    if (input.temporary_password && input.temporary_password.length < 12) throw new Error("A temporary password must contain at least 12 characters.");
    const users = readUsers(); const index = users.findIndex((user) => user.id === id);
    if (index < 0) throw new Error("System user was not found.");
    if (users[index].role === "super_admin" && !input.role_ids.includes(defaultRoleId("super_admin"))) throw new Error("The built-in Super Admin role cannot be removed.");
    if (users.some((user) => user.id !== id && user.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Email address already belongs to a system user.");
    const { temporary_password, ...profileInput } = input;
    users[index] = normalizeSystemUser({ ...users[index], ...profileInput, role: primaryRole(input), updated_at: new Date().toISOString() });
    writeUsers(users); if (temporary_password) await setLocalCredential(id, temporary_password, true); return users[index];
  }
  async listRoles() { return readRoles().sort((a, b) => a.name.localeCompare(b.name)); }
  async createRole(input: AccessRoleInput) {
    const roles = readRoles(); const code = input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!code) throw new Error("Enter a valid role code.");
    if (roles.some((role) => role.code === code)) throw new Error("Role code already exists.");
    const timestamp = new Date().toISOString(); const role: AccessRole = { ...input, code, id: createUuid(), is_system: false, created_at: timestamp, updated_at: timestamp };
    writeRoles([...roles, role]); return role;
  }
  async updateRole(id: string, input: AccessRoleInput) {
    const roles = readRoles(); const index = roles.findIndex((role) => role.id === id);
    if (index < 0) throw new Error("Role was not found.");
    if (roles[index].is_system) throw new Error("The Super Admin policy is immutable.");
    roles[index] = { ...roles[index], ...input, code: roles[index].code, updated_at: new Date().toISOString() }; writeRoles(roles); return roles[index];
  }
  async deleteRole(id: string) {
    const roles = readRoles(); const role = roles.find((item) => item.id === id); if (!role) return;
    if (role.is_system) throw new Error("System roles cannot be deleted.");
    if (readUsers().some((user) => user.role_ids.includes(id))) throw new Error("Reassign users before deleting this role.");
    writeRoles(roles.filter((item) => item.id !== id));
  }
}
