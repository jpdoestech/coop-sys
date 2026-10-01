import { developmentUsers } from "../../../database/seeds/userSeed";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type {
  UserAccessRepository,
  UserListOptions,
} from "../UserAccessRepository";
import { branches, HEAD_OFFICE_ID } from "../../lookups/organization";
import { roleDefinitions } from "../../access/accessControl";
import { setLocalCredential } from "../../auth/local/localCredentialStore";

const STORAGE_KEY = "coop_sys_user_access";

function readUsers(): SystemUser[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as SystemUser[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(developmentUsers));
  return developmentUsers;
}

function writeUsers(users: SystemUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function validateInput(input: SystemUserInput) {
  if (!roleDefinitions.some((role) => role.code === input.role))
    throw new Error("Select a valid system role.");
  const branchScoped =
    input.role === "branch_admin" || input.role === "branch_user";
  if (branchScoped && input.branch_ids.length === 0)
    throw new Error("Assign at least one branch to this role.");
  if (!branchScoped && input.branch_ids.length > 0)
    throw new Error("Organization-wide roles cannot have branch restrictions.");
  const validBranchIds = new Set<string>(
    branches
      .filter((branch) => branch.id !== HEAD_OFFICE_ID)
      .map((branch) => branch.id),
  );
  if (input.branch_ids.some((id) => !validBranchIds.has(id)))
    throw new Error("One or more assigned branches are invalid.");
}

export class LocalUserAccessRepository implements UserAccessRepository {
  async listPage(options: UserListOptions = {}) {
    const term = options.search?.trim().toLowerCase() ?? "";
    const records = readUsers()
      .filter(
        (user) =>
          !term ||
          `${user.display_name} ${user.email}`.toLowerCase().includes(term),
      )
      .filter(
        (user) =>
          options.status === "all" ||
          !options.status ||
          user.is_active === (options.status === "active"),
      )
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    const offset = options.offset ?? 0;
    return {
      items: records.slice(
        offset,
        options.limit ? offset + options.limit : undefined,
      ),
      total: records.length,
    };
  }

  async create(input: SystemUserInput) {
    validateInput(input);
    if (!input.temporary_password || input.temporary_password.length < 12)
      throw new Error(
        "A temporary password of at least 12 characters is required.",
      );
    const users = readUsers();
    if (
      users.some(
        (user) => user.email.toLowerCase() === input.email.toLowerCase(),
      )
    ) {
      throw new Error("Email address already belongs to a system user.");
    }
    const timestamp = new Date().toISOString();
    const { temporary_password, ...profileInput } = input;
    const user: SystemUser = {
      ...profileInput,
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
    };
    writeUsers([...users, user]);
    await setLocalCredential(user.id, temporary_password, true);
    return user;
  }

  async update(id: string, input: SystemUserInput) {
    validateInput(input);
    if (input.temporary_password && input.temporary_password.length < 12)
      throw new Error(
        "A temporary password must contain at least 12 characters.",
      );
    const users = readUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index < 0) throw new Error("System user was not found.");
    if (
      users.some(
        (user) =>
          user.id !== id &&
          user.email.toLowerCase() === input.email.toLowerCase(),
      )
    ) {
      throw new Error("Email address already belongs to a system user.");
    }
    const { temporary_password, ...profileInput } = input;
    users[index] = {
      ...users[index],
      ...profileInput,
      updated_at: new Date().toISOString(),
    };
    writeUsers(users);
    if (temporary_password) {
      await setLocalCredential(id, temporary_password, true);
    }
    return users[index];
  }
}
