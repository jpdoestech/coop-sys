import { developmentUsers } from "../../../database/seeds/userSeed";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type { UserAccessRepository } from "../UserAccessRepository";

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

export class LocalUserAccessRepository implements UserAccessRepository {
  async list() {
    return readUsers().sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  async create(input: SystemUserInput) {
    const users = readUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Email address already belongs to a system user.");
    }
    const timestamp = new Date().toISOString();
    const user: SystemUser = { ...input, id: crypto.randomUUID(), created_at: timestamp, updated_at: timestamp };
    writeUsers([...users, user]);
    return user;
  }

  async update(id: string, input: SystemUserInput) {
    const users = readUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index < 0) throw new Error("System user was not found.");
    if (users.some((user) => user.id !== id && user.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Email address already belongs to a system user.");
    }
    users[index] = { ...users[index], ...input, updated_at: new Date().toISOString() };
    writeUsers(users);
    return users[index];
  }
}

