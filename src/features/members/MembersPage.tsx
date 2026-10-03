import { useDeferredValue, useEffect, useState } from "react";
import { ArrowUpDown, CheckCheck, ClipboardCheck, FileUp, Plus, Search, UsersRound } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import type { Member, MemberInput } from "../../types/member";
import { MemberForm } from "./components/MemberForm";
import { MemberTable } from "./components/MemberTable";
import { useMembers } from "./hooks/useMembers";
import { useAccess } from "../../services/access/useAccess";
import { isBranchScoped } from "../../services/access/accessControl";
import { memberStatuses, memberTypes } from "./data/memberOptions";
import { useOrganization } from "../../services/organization/useOrganization";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { FilterMenu } from "../../components/ui/FilterMenu";
import { MemberApprovalDialog } from "./components/MemberApprovalDialog";
import { PersonImportDialog } from "../../components/forms/PersonImportDialog";
import { EMPLOYMENT_STATUS } from "../../services/lookups/statuses";
import { useAliasManagement } from "../payments/hooks/useAliasManagement";
import { AliasEditor } from "../../components/forms/AliasEditor";

export function MembersPage() {
  const [search, setSearch] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search);
  const { branches, clients } = useOrganization();
  const { profile, can } = useAccess();
  const canCreate = can("members.create") && !isBranchScoped(profile);
  const canImport = can("members.import") && !isBranchScoped(profile);
  const canEdit = can("members.update");
  const canDelete = can("members.delete");
  const canApprove = can("members.approve");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState(() => isBranchScoped(profile) ? profile.branchIds[0] ?? "" : "");
  const [clientFilter, setClientFilter] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeFilterCount = [statusFilter, branchFilter, clientFilter].filter(Boolean).length;
  const { query, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers, importMembers } = useMembers({ search: deferredSearch, statusId: statusFilter, typeId: typeFilter, approvalStatus: approvalFilter, branchId: branchFilter, clientId: clientFilter, sort, limit: pageSize, offset: (page - 1) * pageSize });
  const aliasManagement = useAliasManagement("members.update");
  useEffect(() => setPage(1), [deferredSearch, statusFilter, typeFilter, approvalFilter, branchFilter, clientFilter, sort, pageSize]);
  const pageMembers = query.data?.items ?? [];
  const editingEmployee = (placementEmployees.data ?? []).find((employee) => employee.member_id === editingMember?.id) ?? null;

  function openCreate() {
    setEditingMember(null);
    setFormOpen(true);
  }

  function save(input: MemberInput) {
    saveMember.mutate(
      { member: editingMember, input },
      { onSuccess: () => setFormOpen(false) }
    );
  }

  function archive(member: Member) {
    const confirmed = window.confirm(`Archive ${member.first_name} ${member.last_name}? The record can be restored later.`);
    if (confirmed) archiveMember.mutate(member.id);
  }

  function toggleSelection(memberId: string) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(memberId)) next.delete(memberId); else next.add(memberId); return next; });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Members"
          title="Cooperative members"
          description="Maintain registration, contact, and membership details. Employee relationships are linked from the employee record."
        />
        {canCreate || canImport ? <div className="mb-3 flex w-full flex-wrap gap-2 sm:w-auto">{canImport ? <button className="secondary-button flex-1 whitespace-nowrap sm:flex-none" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import Excel</button> : null}{canCreate ? <button className="primary-button flex-1 whitespace-nowrap sm:flex-none" onClick={openCreate}><Plus className="h-4 w-4" /> New member</button> : null}</div> : null}
      </div>

      <section className="overflow-visible rounded-md border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <div className="relative w-full sm:w-56 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              className="compact-control w-full pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              aria-label="Search members"
            />
          </div>
          <div className="relative min-w-[150px] flex-1 sm:flex-none"><ClipboardCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><select aria-label="Filter BOD approval" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} className="compact-control w-full pl-8 sm:w-40"><option value="">All approvals</option><option value="pending">Pending approval</option><option value="approved">Approved</option></select></div>
          <div className="relative min-w-[150px] flex-1 sm:flex-none"><UsersRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><select aria-label="Filter membership type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="compact-control w-full pl-8 sm:w-40"><option value="">All member types</option>{memberTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="flex items-center gap-2">
            <FilterMenu label="More filters" activeCount={activeFilterCount} onClear={() => { setStatusFilter(""); setBranchFilter(""); setClientFilter(""); }}>
              <label className="block text-xs font-semibold text-ink/60">Membership status<select aria-label="Filter member status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All statuses</option>{memberStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Office or branch<select aria-label="Filter member branch" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setClientFilter(""); }} className="control mt-1.5 w-full font-normal"><option value="">All offices and branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Client<select aria-label="Filter member client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All clients</option>{clients.filter((item) => !branchFilter || item.branchId === branchFilter).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </FilterMenu>
            <div className="relative"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><select aria-label="Sort members" value={sort} onChange={(event) => setSort(event.target.value)} className="compact-control w-36 pl-8"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Member number</option><option value="joined-desc">Newest membership</option></select></div>
          </div>
          <p className="ml-auto hidden whitespace-nowrap text-[11px] text-ink/40 xl:block">{query.data?.total ?? 0} records</p>
          {canApprove && selectedIds.size ? <button type="button" onClick={() => { approveMembers.reset(); setApprovalOpen(true); }} className="primary-button"><CheckCheck className="h-4 w-4" /> Approve {selectedIds.size}</button> : null}
        </div>
        {query.isError ? (
          <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load member records.</div>
        ) : (
          <MemberTable members={pageMembers} loading={query.isLoading} canEdit={canEdit} canDelete={canDelete} canApprove={canApprove} selectedIds={selectedIds} onToggle={toggleSelection} onTogglePage={(ids, selected) => setSelectedIds((current) => { const next = new Set(current); ids.forEach((id) => selected ? next.add(id) : next.delete(id)); return next; })} onEdit={(member) => { setEditingMember(member); setFormOpen(true); }} onArchive={archive} />
        )}
        <PaginationControls page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>

      {formOpen ? (
        <MemberForm member={editingMember} suggestedNumber={personNumber.data ?? ""} saving={saveMember.isPending} canViewSensitive={can("members.sensitive.view")} canEditSensitive={can("members.sensitive.update")} aliasEditor={canEdit ? <AliasEditor employeeId={editingEmployee?.id ?? null} clientId={editingEmployee?.active_assignment?.client_id ?? null} aliases={aliasManagement.query.data ?? []} clients={clients.filter((client) => !isBranchScoped(profile) || profile.branchIds.includes(client.branchId))} saving={aliasManagement.save.isPending} onSave={aliasManagement.save.mutateAsync} onArchive={aliasManagement.archive.mutateAsync} /> : undefined} onCancel={() => setFormOpen(false)} onSubmit={save} />
      ) : null}
      {importOpen ? <PersonImportDialog kind="member" linkOptions={(placementEmployees.data ?? []).filter((employee) => !employee.member_id).map((employee) => ({ id: employee.id, number: employee.employee_number, name: `${employee.last_name}, ${employee.first_name}`, isActive: employee.employment_status_id === EMPLOYMENT_STATUS.active }))} importing={importMembers.isPending} importError={importMembers.error?.message} onClose={() => setImportOpen(false)} onImport={(rows) => importMembers.mutate(rows, { onSuccess: () => setImportOpen(false) })} /> : null}
      {approvalOpen ? <MemberApprovalDialog count={selectedIds.size} resolutionNumber={approvalSequence.data ?? ""} saving={approveMembers.isPending} error={approveMembers.error?.message} onCancel={() => setApprovalOpen(false)} onApprove={(approvalDate) => approveMembers.mutate({ ids: [...selectedIds], approvalDate }, { onSuccess: () => { setApprovalOpen(false); setSelectedIds(new Set()); } })} /> : null}
    </>
  );
}
