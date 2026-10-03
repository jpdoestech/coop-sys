import type { SystemUser } from "../../types/systemUser";
import { normalizeSystemUser } from "../../services/access/userAccessModel";

const timestamp = "2026-09-01T08:00:00.000Z";

export const developmentUsers: SystemUser[] = [
  { id: "72000000-0000-4000-8000-000000000001", display_name: "System Administrator", email: "admin@example.test", role: "super_admin", branch_ids: [], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000002", display_name: "General Manager", email: "general.manager@example.test", role: "general_manager", branch_ids: [], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000003", display_name: "HR Manager", email: "hr.manager@example.test", role: "hr_manager", branch_ids: [], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000004", display_name: "Accounting Manager", email: "accounting.manager@example.test", role: "accounting_manager", branch_ids: [], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000005", display_name: "Head Office Staff", email: "head.office@example.test", role: "head_office_staff", branch_ids: [], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000006", display_name: "Davao Branch Admin", email: "davao.admin@example.test", role: "branch_admin", branch_ids: ["60000000-0000-4000-8000-000000000001"], is_active: true, created_at: timestamp, updated_at: timestamp },
  { id: "72000000-0000-4000-8000-000000000007", display_name: "Branch User", email: "branch.user@example.test", role: "branch_user", branch_ids: ["60000000-0000-4000-8000-000000000001", "60000000-0000-4000-8000-000000000002"], is_active: true, created_at: timestamp, updated_at: timestamp },
].map((user) => normalizeSystemUser(user as SystemUser));

