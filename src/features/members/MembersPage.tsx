import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Plus, Search } from "lucide-react";
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

export function MembersPage() {
  const [search, setSearch] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { query, placementEmployees, saveMember, archiveMember } = useMembers(deferredSearch);
  const { branches, clients } = useOrganization();
  const { profile, can } = useAccess();
  const canManage = can("members.manage");
  const canCreate = canManage && !isBranchScoped(profile);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeFilterCount = [statusFilter, typeFilter, branchFilter, clientFilter].filter(Boolean).length;
  const filteredMembers = useMemo(() => {
    const employees = placementEmployees.data ?? [];
    return [...(query.data ?? [])].filter((member) => {
      const linked = employees.filter((employee) => employee.member_id === member.id);
      return (!statusFilter || member.membership_status_id === statusFilter) && (!typeFilter || member.membership_type_id === typeFilter) && (!branchFilter || linked.some((employee) => employee.active_assignment?.branch_id === branchFilter)) && (!clientFilter || linked.some((employee) => employee.active_assignment?.client_id === clientFilter));
    }).sort((a, b) => sort === "name-desc" ? b.last_name.localeCompare(a.last_name) : sort === "number-asc" ? a.membership_number.localeCompare(b.membership_number) : sort === "joined-desc" ? (b.membership_date ?? "").localeCompare(a.membership_date ?? "") : a.last_name.localeCompare(b.last_name));
  }, [query.data, placementEmployees.data, statusFilter, typeFilter, branchFilter, clientFilter, sort]);
  useEffect(() => setPage(1), [deferredSearch, statusFilter, typeFilter, branchFilter, clientFilter, sort, pageSize]);
  const pageMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize);

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

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Members"
          title="Cooperative members"
          description="Maintain registration, contact, and membership details. Employee relationships are linked from the employee record."
        />
        {canCreate ? <button className="primary-button mb-3" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New member
        </button> : null}
      </div>

      <section className="overflow-visible rounded-md border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              className="control w-full pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              aria-label="Search members"
            />
          </div>
          <p className="hidden whitespace-nowrap text-xs text-ink/45 md:block">{filteredMembers.length} records</p>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <FilterMenu activeCount={activeFilterCount} onClear={() => { setStatusFilter(""); setTypeFilter(""); setBranchFilter(""); setClientFilter(""); }}>
              <label className="block text-xs font-semibold text-ink/60">Membership status<select aria-label="Filter member status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All statuses</option>{memberStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Membership type<select aria-label="Filter membership type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All member types</option>{memberTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Office or branch<select aria-label="Filter member branch" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setClientFilter(""); }} className="control mt-1.5 w-full font-normal"><option value="">All offices and branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Client<select aria-label="Filter member client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All clients</option>{clients.filter((item) => !branchFilter || item.branchId === branchFilter).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </FilterMenu>
            <div className="relative flex-1 sm:flex-none"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" /><select aria-label="Sort members" value={sort} onChange={(event) => setSort(event.target.value)} className="control w-full pl-9 sm:w-40"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Member number</option><option value="joined-desc">Newest membership</option></select></div>
          </div>
        </div>
        {query.isError ? (
          <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load member records.</div>
        ) : (
          <MemberTable members={pageMembers} loading={query.isLoading} canManage={canManage} onEdit={(member) => { setEditingMember(member); setFormOpen(true); }} onArchive={archive} />
        )}
        <PaginationControls page={page} pageSize={pageSize} total={filteredMembers.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>

      {formOpen ? (
        <MemberForm member={editingMember} saving={saveMember.isPending} onCancel={() => setFormOpen(false)} onSubmit={save} />
      ) : null}
    </>
  );
}
