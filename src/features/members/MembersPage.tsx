import { FilterField } from "../../components/ui/FilterField";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { useConfirmation } from "../../components/forms/unsavedChanges";
import { useDeferredValue, useEffect, useState } from "react";
import { ArrowUpDown, CheckCheck, CircleDotDashed, ClipboardCheck, FileUp, Plus, Search, UsersRound } from "lucide-react";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import type { Member } from "../../types/member";
import { MemberForm } from "./components/MemberForm";
import { MemberTable } from "./components/MemberTable";
import { useMembers } from "./hooks/useMembers";
import { useAccess } from "../../services/access/useAccess";
import { isBranchScoped } from "../../services/access/accessControl";
import { placementOptions } from "../../services/access/placementOptions";
import { memberStatuses, memberTypes } from "./data/memberOptions";
import { useOrganization } from "../../services/organization/useOrganization";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { PlacementSelectors } from "../../components/forms/PlacementSelectors";
import { MemberApprovalDialog } from "./components/MemberApprovalDialog";
import { PersonImportDialog } from "../../components/forms/PersonImportDialog";
import { EMPLOYMENT_STATUS } from "../../services/lookups/statuses";
import { useAliasManagement } from "../payments/hooks/useAliasManagement";
import { AliasEditor } from "../../components/forms/AliasEditor";
import type { MemberSubmission } from "./types/memberWorkflow";

export function MembersPage() {
  const confirm = useConfirmation();
  const [search, setSearch] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search);
  const { branches, clients, departments, positions } = useOrganization();
  const { profile, can } = useAccess();
  const { branches: scopedBranches, clients: scopedClients } = placementOptions(profile, branches, clients);
  const canCreate = can("members.create");
  const canImport = can("members.import");
  const canEdit = can("members.update");
  const canDelete = can("members.delete");
  const canApprove = can("members.approve");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(25);
  const { query, linkedEmployee, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers, importMembers } = useMembers({ search: deferredSearch, attentionOnly, statusId: statusFilter, typeId: typeFilter, approvalStatus: approvalFilter, branchId: branchFilter, clientId: clientFilter, sort, limit: pageSize, offset: (page - 1) * pageSize }, formOpen ? editingMember?.id : null);
  const aliasManagement = useAliasManagement("members.update");
  useEffect(() => setPage(1), [deferredSearch, attentionOnly, statusFilter, typeFilter, approvalFilter, branchFilter, clientFilter, sort, pageSize]);
  const pageMembers = query.data?.items ?? [];
  const editingEmployee = linkedEmployee.data ?? null;

  function openCreate() {
    saveMember.reset();
    setEditingMember(null);
    setFormOpen(true);
  }

  function save(submission: MemberSubmission) {
    saveMember.mutate(
      { member: editingMember, submission },
      { onSuccess: () => setFormOpen(false) }
    );
  }

  function archive(member: Member) {
    confirm(`Archive ${member.first_name} ${member.last_name}? The record can be restored later.`, () => archiveMember.mutate(member.id), "Archive member", "Archive");
  }

  function toggleSelection(memberId: string) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(memberId)) next.delete(memberId); else next.add(memberId); return next; });
  }

  return (
    <>
      <PageHeader title="Members" />
      <section className="overflow-visible rounded-md border border-line bg-white shadow-panel">
        <div className="data-toolbar" aria-label="Member tools">
          <div className="relative min-w-[160px] flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              className="compact-control w-full pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              aria-label="Search members"
            />
          </div>
          <ToolbarDisclosure label="Member filters" icon={SlidersHorizontal} count={[statusFilter, typeFilter, approvalFilter, branchFilter, clientFilter].filter(Boolean).length + Number(attentionOnly) + Number(sort !== "name-asc")}><div className="toolbar-filters">
            <FilterField label="Status"><div className="relative"><CircleDotDashed className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Membership status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="compact-control w-full pl-8"><option value="">All statuses</option>{memberStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></div></FilterField>
            <FilterField label="Membership Type"><div className="relative"><UsersRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Filter membership type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="compact-control w-full pl-8"><option value="">All member types</option>{memberTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></div></FilterField>
            <FilterField label="BOD Approval"><div className="relative"><ClipboardCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Filter BOD approval" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} className="compact-control w-full pl-8"><option value="">All approvals</option><option value="pending">Pending approval</option><option value="approved">Approved</option></SearchableSelect></div></FilterField>
            <FilterField label="Sort Order"><div className="relative"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Sort members" value={sort} onChange={(event) => setSort(event.target.value)} className="compact-control w-full pl-8"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Member number</option><option value="joined-desc">Newest membership</option></SearchableSelect></div></FilterField>
            <PlacementSelectors layout="filters" branchId={branchFilter} clientId={clientFilter} onBranchChange={(value) => { setBranchFilter(value); setClientFilter(""); }} onClientChange={setClientFilter} />
            <label className="filter-toggle"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />Needs attention</label>
          </div></ToolbarDisclosure>
          <button type="button" className="icon-button" title="Reset filters" aria-label="Reset filters" onClick={() => { setStatusFilter(""); setTypeFilter(""); setApprovalFilter(""); setBranchFilter(""); setClientFilter(""); setAttentionOnly(false); setSort("name-asc"); setSearch(""); }}><RotateCcw className="h-4 w-4" /></button>
          <span className="hidden whitespace-nowrap text-[11px] text-ink/40 sm:block">{query.data?.total ?? 0} records</span>
          {canCreate || canImport ? <div className="toolbar-actions">{canImport ? <button className="icon-button" title="Import members from Excel" aria-label="Import members from Excel" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /></button> : null}{canCreate ? <button className="primary-button" title="New member" aria-label="New member" onClick={openCreate}><Plus className="h-4 w-4" /><span className="hidden sm:inline">New member</span></button> : null}</div> : null}
          {canApprove && selectedIds.size ? <button type="button" onClick={() => { approveMembers.reset(); setApprovalOpen(true); }} className="primary-button"><CheckCheck className="h-4 w-4" /> Approve {selectedIds.size}</button> : null}        </div>
        {query.isError ? (
          <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load member records.</div>
        ) : (
          <MemberTable members={pageMembers} loading={query.isLoading} canEdit={canEdit} canDelete={canDelete} canApprove={canApprove} selectedIds={selectedIds} onToggle={toggleSelection} onTogglePage={(ids, selected) => setSelectedIds((current) => { const next = new Set(current); ids.forEach((id) => selected ? next.add(id) : next.delete(id)); return next; })} onEdit={(member) => { setEditingMember(member); setFormOpen(true); }} onArchive={archive} />
        )}
        <PaginationControls page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>

      {formOpen ? (
        <MemberForm
          member={editingMember}
          linkedEmployee={editingEmployee}
          placementLoading={Boolean(editingMember) && (linkedEmployee.isLoading || linkedEmployee.isError)}
          saveError={linkedEmployee.error?.message ?? saveMember.error?.message}
          suggestedNumber={personNumber.data ?? ""}
          saving={saveMember.isPending}
          canViewSensitive={can("members.sensitive.view")}
          canEditSensitive={can("members.sensitive.update")}
          aliasEditor={canEdit ? <AliasEditor employeeId={editingEmployee?.id ?? null} clientId={editingEmployee?.active_assignment?.client_id ?? null} aliases={aliasManagement.query.data ?? []} clients={clients.filter((client) => !isBranchScoped(profile) || profile.branchIds.includes(client.branchId))} saving={aliasManagement.save.isPending} onSave={aliasManagement.save.mutateAsync} onArchive={aliasManagement.archive.mutateAsync} /> : undefined}
          onCancel={() => setFormOpen(false)}
          onSubmit={save}
        />
      ) : null}
      {importOpen ? <PersonImportDialog kind="member" branches={scopedBranches} clients={scopedClients} lookups={{ departments, positions }} requireClient={profile.scopeType === "assigned_clients"} linkOptions={(placementEmployees.data ?? []).filter((employee) => !employee.member_id).map((employee) => ({ id: employee.id, number: employee.employee_number, name: `${employee.last_name}, ${employee.first_name}`, isActive: employee.employment_status_id === EMPLOYMENT_STATUS.active }))} importing={importMembers.isPending} importError={importMembers.error?.message} onClose={() => setImportOpen(false)} onImport={(rows, branchId, clientId, onProgress) => importMembers.mutateAsync({ rows, branchId, clientId, onProgress })} /> : null}
      {approvalOpen ? <MemberApprovalDialog count={selectedIds.size} resolutionNumber={approvalSequence.data ?? ""} saving={approveMembers.isPending} error={approveMembers.error?.message || approvalSequence.error?.message} onCancel={() => setApprovalOpen(false)} onApprove={(approvalDate) => approveMembers.mutate({ ids: [...selectedIds], approvalDate }, { onSuccess: () => { setApprovalOpen(false); setSelectedIds(new Set()); } })} /> : null}
    </>
  );
}
