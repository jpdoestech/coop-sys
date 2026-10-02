import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import { serverRequest } from "../../server/serverApi";
import type { UserAccessRepository, UserListOptions } from "../UserAccessRepository";

export class ServerUserAccessRepository implements UserAccessRepository {
  async listPage(options: UserListOptions = {}) {
    const query = new URLSearchParams();
    if (options.search) query.set("search", options.search);
    if (options.status) query.set("status", options.status);
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    return serverRequest<{ items: SystemUser[]; total: number }>(`/users?${query}`);
  }

  async create(input: SystemUserInput) {
    return serverRequest<SystemUser>("/users", { method: "POST", body: JSON.stringify(input) });
  }

  async update(id: string, input: SystemUserInput) {
    return serverRequest<SystemUser>(`/users/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
  }
}
