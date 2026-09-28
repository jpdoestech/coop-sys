import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ListFilter, Plus, Search } from "lucide-react";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Members"
          title="Cooperative members"
          description="Maintain registration, contact, and membership details. Employee relationships are linked from the employee record."
        />
        {canCreate ? <button className="focus-ring mb-6 inline-flex items-center justify-center gap-2 rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss/90" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New member
        </button> : null}
      </div>

      <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(130px,180px))]">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
            <input
              className="focus-ring w-full rounded border border-line bg-paper/40 py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink/45"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or membership number"
              aria-label="Search members"
            />
          </div>
          <select aria-label="Filter member status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="focus-ring rounded border border-line bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option>{memberStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select aria-label="Filter membership type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="focus-ring rounded border border-line bg-white px-3 py-2.5 text-sm"><option value="">All member types</option>{memberTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select aria-label="Sort members" value={sort} onChange={(event) => setSort(event.target.value)} className="focus-ring rounded border border-line bg-white px-3 py-2.5 text-sm"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Member number</option><option value="joined-desc">Newest membership</option></select>
          <div className="flex items-center gap-2 lg:col-span-4"><ListFilter className="h-4 w-4 text-ink/45" /><select aria-label="Filter member branch" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setClientFilter(""); }} className="focus-ring min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 text-sm"><option value="">All offices and branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="Filter member client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="focus-ring min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 text-sm"><option value="">All clients</option>{clients.filter((item) => !branchFilter || item.branchId === branchFilter).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
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
