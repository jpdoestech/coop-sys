import { useDeferredValue, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import type { Member, MemberInput } from "../../types/member";
import { MemberForm } from "./components/MemberForm";
import { MemberTable } from "./components/MemberTable";
import { useMembers } from "./hooks/useMembers";
import { useAccess } from "../../services/access/AccessContext";
import { isBranchScoped } from "../../services/access/accessControl";

export function MembersPage() {
  const [search, setSearch] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { query, saveMember, archiveMember } = useMembers(deferredSearch);
  const { profile, can } = useAccess();
  const canManage = can("members.manage");
  const canCreate = canManage && !isBranchScoped(profile);

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
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <p className="text-xs text-ink/55">{query.data?.length ?? 0} records shown</p>
        </div>
        {query.isError ? (
          <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load member records.</div>
        ) : (
          <MemberTable members={query.data ?? []} loading={query.isLoading} canManage={canManage} onEdit={(member) => { setEditingMember(member); setFormOpen(true); }} onArchive={archive} />
        )}
      </section>

      {formOpen ? (
        <MemberForm member={editingMember} saving={saveMember.isPending} onCancel={() => setFormOpen(false)} onSubmit={save} />
      ) : null}
    </>
  );
}
