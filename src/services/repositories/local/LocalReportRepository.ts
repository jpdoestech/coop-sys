import { employeeIsInScope, memberIsInScope, type AccessProfile } from "../../access/accessControl";
import type { ReportPage, ReportQuery, ReportRepository, ReportRow } from "../ReportRepository";
import { assertReportAccess, reportCell, validateReportQuery } from "../../reports/reportCore";
import { LocalMemberRepository } from "./LocalMemberRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";
import { hasImportAttention } from "../../imports/importAttention";
import { MEMBER_STATUS, EMPLOYMENT_STATUS } from "../../lookups/statuses";

export class LocalReportRepository implements ReportRepository {
  async listPage(raw: ReportQuery, profile: AccessProfile): Promise<ReportPage> {
    const query = validateReportQuery(raw); assertReportAccess(profile, query);
    const [members, employees, directory] = await Promise.all([new LocalMemberRepository().list(), new LocalEmployeeRepository().list(), new LocalOrganizationDirectoryRepository().getDirectory()]);
    const label = (items: { id: string; label: string }[], id?: string | null, fallback = "Not set") => items.find((item) => item.id === id)?.label || fallback;
    const placements = new Map(employees.map((employee) => [employee.member_id, employee.active_assignment]));
    let records: Array<ReportRow & { departmentId: string }> = (query.kind === "members" ? members.filter((item) => memberIsInScope(item, profile, employees)).map((member) => ({ person: member, branchId: placements.has(member.id) ? placements.get(member.id)?.branch_id : member.proposed_branch_id, clientId: placements.has(member.id) ? placements.get(member.id)?.client_id : member.proposed_client_id, number: member.membership_number, statusId: member.membership_status_id, typeId: member.membership_type_id, date: member.membership_date, approval: member.bod_approval_status })) : employees.filter((item) => employeeIsInScope(item, profile)).map((employee) => ({ person: employee, branchId: employee.active_assignment?.branch_id, clientId: employee.active_assignment?.client_id, number: employee.employee_number, statusId: employee.employment_status_id, typeId: employee.employment_type_id, date: employee.date_hired, approval: "" }))).map(({ person, branchId, clientId, number, statusId, typeId, date, approval }) => ({ id: person.id, number, name: `${person.last_name}, ${person.first_name}${person.middle_name ? ` ${person.middle_name}` : ""}${person.suffix ? ` ${person.suffix}` : ""}`, branchId: branchId || "", clientId: clientId || "", branch: label(directory.branches, branchId, "No placement"), client: label(directory.clients, clientId, "Direct employee"), departmentId: person.department_id || "", department: person.pending_department_name || label(directory.departments, person.department_id), position: person.pending_position_name || label(directory.positions, person.position_id), statusId: statusId || "", typeId: typeId || "", date: date || "", approval, attention: hasImportAttention(person), employees: 1, active: Number(statusId === (query.kind === "members" ? MEMBER_STATUS.active : EMPLOYMENT_STATUS.active)), direct: Number(!clientId), clientDeployed: Number(Boolean(clientId)) }));
    records = records.filter((row) => (!query.search || `${row.number} ${row.name} ${row.branch} ${row.client} ${row.department} ${row.position}`.toLowerCase().includes(query.search.toLowerCase())) && (!query.branchId || row.branchId === query.branchId) && (!query.clientId || row.clientId === query.clientId) && (!query.statusId || row.statusId === query.statusId) && (!query.typeId || row.typeId === query.typeId) && (!query.departmentId || row.departmentId === query.departmentId) && (!query.approval || row.approval === query.approval) && (!query.attentionOnly || row.attention) && (!query.dateFrom || row.date >= query.dateFrom) && (!query.dateTo || Boolean(row.date && row.date <= query.dateTo)));
    let rows: ReportRow[] = records;
    if (query.kind === "deployment") {
      const groups = new Map<string, ReportRow>();
      for (const record of records) {
        const id = `${record.branchId}:${record.clientId}`; const current = groups.get(id);
        groups.set(id, current ? { ...current, employees: current.employees + 1, active: current.active + record.active, direct: current.direct + record.direct, clientDeployed: current.clientDeployed + record.clientDeployed, attention: current.attention || record.attention } : { ...record, id, number: "", name: "" });
      }
      rows = [...groups.values()];
    }
    const key = query.sort || (query.kind === "deployment" ? "branch" : "name"), direction = query.direction === "desc" ? -1 : 1;
    rows.sort((a, b) => { const left = reportCell(a, key, query.kind), right = reportCell(b, key, query.kind); return (typeof a[key] === "number" || typeof a[key] === "boolean" ? Number(a[key]) - Number(b[key]) : left.localeCompare(right)) * direction || a.id.localeCompare(b.id); });
    return { items: rows.slice(query.offset, query.offset! + query.limit!), total: rows.length, records: records.length, active: records.reduce((sum, row) => sum + row.active, 0), pending: records.filter((row) => row.approval === "pending").length, attention: records.filter((row) => row.attention).length };
  }
}
