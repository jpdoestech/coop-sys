import { useDeferredValue, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Network,
  Pencil,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useOrganization } from "../../services/organization/useOrganization";
import type {
  OrganizationBranch,
  OrganizationClient,
  OrganizationDepartment,
  OrganizationPosition,
} from "../../types/organization";
import {
  OrganizationRecordForm,
  type OrganizationKind,
} from "./components/OrganizationRecordForm";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useOrganizationRecords } from "./hooks/useOrganizationRecords";

type RecordValue =
  | OrganizationBranch
  | OrganizationClient
  | OrganizationDepartment
  | OrganizationPosition;
const tabs: Array<{
  id: OrganizationKind;
  label: string;
  icon: typeof Building2;
}> = [
  { id: "branch", label: "Offices & branches", icon: Building2 },
  { id: "client", label: "Branch clients", icon: BriefcaseBusiness },
  { id: "department", label: "Departments", icon: Network },
  { id: "position", label: "Positions", icon: UsersRound },
];

export function OrganizationPage() {
  const directory = useOrganization();
  const [kind, setKind] = useState<OrganizationKind>("branch");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deferredSearch = useDeferredValue(search);
  const recordsQuery = useOrganizationRecords(kind, {
    search: deferredSearch,
    status: status as "active" | "inactive" | "all",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const records = (recordsQuery.data?.items ?? []) as RecordValue[];
  useEffect(() => setPage(1), [deferredSearch, kind, status, pageSize]);

  function relation(record: RecordValue) {
    if ("branchId" in record)
      return (
        directory.branches.find((item) => item.id === record.branchId)?.label ??
        "Unassigned"
      );
    if ("departmentId" in record)
      return (
        directory.departments.find((item) => item.id === record.departmentId)
          ?.label ?? "Unassigned"
      );
    if ("type" in record)
      return record.type === "head_office"
        ? "Top-level office"
        : "Under Head Office";
    return "Internal department";
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Organization"
          title="Organization administration"
          description="Maintain the Head Office hierarchy, branches, branch clients, departments, and positions."
        />
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          disabled={
            kind === "branch" &&
            !directory.branches.some((item) => item.type === "head_office")
          }
          className="primary-button mb-3"
        >
          <Plus className="h-4 w-4" /> Add {kind}
        </button>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-max rounded-md border border-line bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setKind(tab.id);
                setSearch("");
                setPage(1);
              }}
              className={`focus-ring inline-flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition ${kind === tab.id ? "bg-[#e4efe9] text-moss" : "text-ink/55 hover:bg-paper hover:text-ink"}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <section className="mt-4 overflow-hidden rounded-md border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <div className="relative w-full sm:w-56 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="compact-control w-full pl-9"
              placeholder={`Search ${tabs.find((item) => item.id === kind)?.label.toLowerCase()}`}
              aria-label="Search organization records"
            />
          </div>
          <select
            aria-label="Filter organization status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="compact-control w-full sm:w-36"
          >
            <option value="active">Active records</option>
            <option value="inactive">Inactive records</option>
            <option value="all">All statuses</option>
          </select>
          <p className="ml-auto hidden whitespace-nowrap text-[11px] text-ink/40 sm:block">
            {recordsQuery.data?.total ?? 0} records
          </p>
        </div>
        <div className="max-h-[62vh] overflow-auto border-t border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-[#f8faf8] text-[10px] uppercase text-ink/45">
                <th className="px-5 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Parent / group</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="w-16 px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="transition-colors hover:bg-[#f8faf8]"
                >
                  <td className="px-5 py-2.5 font-mono text-xs text-ink/55">
                    {record.code}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{record.label}</td>
                  <td className="px-4 py-2.5 text-ink/60">
                    {relation(record)}
                  </td>
                  <td className="px-4 py-2.5">
                    {record.isActive ? (
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
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setEditing(record);
                        setOpen(true);
                      }}
                      className="icon-button h-8 w-8"
                      title="Edit record"
                      aria-label={`Edit ${record.label}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recordsQuery.isLoading && !records.length ? (
            <p className="px-5 py-12 text-center text-sm text-ink/55">
              No records match your search and status.
            </p>
          ) : null}
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={recordsQuery.data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
      {open ? (
        <OrganizationRecordForm
          kind={kind}
          record={editing}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void recordsQuery.refetch();
          }}
        />
      ) : null}
    </>
  );
}
