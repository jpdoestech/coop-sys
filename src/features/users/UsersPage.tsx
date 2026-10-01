import { useDeferredValue, useEffect, useState } from "react";
import { Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { roleLabel } from "../../services/access/accessControl";
import { branches } from "../../services/lookups/organization";
import type { SystemUser, SystemUserInput } from "../../types/systemUser";
import { UserAccessForm } from "./components/UserAccessForm";
import { useUsers } from "./hooks/useUsers";
import { useAuth } from "../../services/auth/useAuth";
import { PaginationControls } from "../../components/ui/PaginationControls";

function scopeLabel(user: SystemUser) {
  if (!user.branch_ids.length) return "All offices and branches";
  return user.branch_ids
    .map(
      (id) =>
        branches.find((branch) => branch.id === id)?.label ?? "Unknown branch",
    )
    .join(", ");
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const deferredSearch = useDeferredValue(search);
  const { query, saveUser } = useUsers({
    search: deferredSearch,
    status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  useEffect(() => setPage(1), [deferredSearch, status, pageSize]);
  function save(input: SystemUserInput) {
    saveUser.mutate(
      { user: editing, input },
      { onSuccess: () => setOpen(false) },
    );
  }
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Administration"
          title="System users"
          description="Assign operating roles and limit branch teams to the branches they are responsible for."
        />
        <button
          onClick={() => {
            saveUser.reset();
            setEditing(null);
            setOpen(true);
          }}
          className="primary-button mb-3"
        >
          <Plus className="h-4 w-4" /> Add user
        </button>
      </div>
      <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
        <div className="flex items-center gap-3 px-5 py-4">
          <ShieldCheck className="h-5 w-5 text-moss" />
          <div>
            <p className="text-sm font-semibold">Role and branch assignments</p>
            <p className="text-xs text-ink/55">
              Only Super Admin can maintain this list.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              className="compact-control w-full pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
            />
          </div>
          <select
            className="compact-control w-full sm:w-36"
            aria-label="Filter user status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="active">Active users</option>
            <option value="inactive">Inactive users</option>
            <option value="all">All statuses</option>
          </select>
          <span className="ml-auto text-[11px] text-ink/45">
            {query.data?.total ?? 0} records
          </span>
        </div>
        <div className="max-h-[62vh] overflow-auto border-t border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-[#f8faf8] text-[11px] uppercase text-ink/45">
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Access scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-16 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.data?.items.map((user) => (
                <tr key={user.id} className="hover:bg-[#f8faf8]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{user.display_name}</p>
                    <p className="text-xs text-ink/55">{user.email}</p>
                  </td>
                  <td className="px-4 py-3.5">{roleLabel(user.role)}</td>
                  <td className="px-4 py-3.5 text-ink/70">
                    {scopeLabel(user)}
                  </td>
                  <td className="px-4 py-3.5">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-paper px-2 py-1 text-xs text-ink/50">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => {
                        saveUser.reset();
                        setEditing(user);
                        setOpen(true);
                      }}
                      className="icon-button"
                      title="Edit user"
                      aria-label={`Edit ${user.display_name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-ink/55">
              Loading system users...
            </p>
          ) : null}
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={query.data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
      {open ? (
        <UserAccessForm
          user={editing}
          offline={session?.mode === "offline"}
          saving={saveUser.isPending}
          error={saveUser.error?.message}
          onCancel={() => setOpen(false)}
          onSubmit={save}
        />
      ) : null}
    </>
  );
}
