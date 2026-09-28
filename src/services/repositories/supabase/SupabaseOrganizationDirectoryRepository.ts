import { supabase } from "../../../database/supabase/client";
import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationDirectory, OrganizationPosition } from "../../../types/organization";
import type { OrganizationDirectoryRepository } from "../OrganizationDirectoryRepository";

function client() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }

export class SupabaseOrganizationDirectoryRepository implements OrganizationDirectoryRepository {
  async getDirectory(): Promise<OrganizationDirectory> {
    const db = client();
    const [branchResult, clientResult, departmentResult, positionResult] = await Promise.all([
      db.from("branches").select("*").is("deleted_at", null).order("name"),
      db.from("clients").select("*").is("deleted_at", null).order("name"),
      db.from("departments").select("*").is("deleted_at", null).order("name"),
      db.from("positions").select("*").is("deleted_at", null).order("name"),
    ]);
    const error = branchResult.error ?? clientResult.error ?? departmentResult.error ?? positionResult.error;
    if (error) throw error;
    return {
      branches: (branchResult.data ?? []).map((row) => ({ id: row.id, code: row.code, label: row.name, address: row.address ?? "", type: row.unit_type, parentId: row.parent_branch_id, isActive: row.is_active })),
      clients: (clientResult.data ?? []).map((row) => ({ id: row.id, code: row.code, label: row.name, branchId: row.branch_id, address: row.address ?? "", contactPerson: row.contact_person ?? "", contactDetails: row.contact_details ?? "", isActive: row.is_active })),
      departments: (departmentResult.data ?? []).map((row) => ({ id: row.id, code: row.code, label: row.name, description: row.description ?? "", isActive: row.is_active })),
      positions: (positionResult.data ?? []).map((row) => ({ id: row.id, code: row.code, label: row.name, departmentId: row.department_id ?? "", description: row.description ?? "", isActive: row.is_active })),
    };
  }
  async saveBranch(record: OrganizationBranch) { const { error } = await client().from("branches").upsert({ id: record.id, code: record.code, name: record.label, address: record.address, unit_type: record.type, parent_branch_id: record.parentId, is_active: record.isActive, updated_at: new Date().toISOString() }); if (error) throw error; }
  async saveClient(record: OrganizationClient) { const { error } = await client().from("clients").upsert({ id: record.id, code: record.code, name: record.label, branch_id: record.branchId, address: record.address, contact_person: record.contactPerson, contact_details: record.contactDetails, is_active: record.isActive, updated_at: new Date().toISOString() }); if (error) throw error; }
  async saveDepartment(record: OrganizationDepartment) { const { error } = await client().from("departments").upsert({ id: record.id, code: record.code, name: record.label, description: record.description, is_active: record.isActive, updated_at: new Date().toISOString() }); if (error) throw error; }
  async savePosition(record: OrganizationPosition) { const { error } = await client().from("positions").upsert({ id: record.id, code: record.code, name: record.label, department_id: record.departmentId || null, description: record.description, is_active: record.isActive, updated_at: new Date().toISOString() }); if (error) throw error; }
}
