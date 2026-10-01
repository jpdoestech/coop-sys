import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { roleLabel } from "../../services/access/accessControl";
import { useAccess } from "../../services/access/useAccess";
import type { DashboardMembershipStatus } from "../../types/dashboard";
import { useDashboard } from "./hooks/useDashboard";

const statusStyles: Record<DashboardMembershipStatus["key"], string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  resigned: "bg-amber-500",
  terminated: "bg-rose-500",
};

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-ink/55">{label}</span>
        <span className="text-moss/80">{icon}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <strong className="text-2xl font-semibold leading-none text-ink">{value.toLocaleString()}</strong>
        <span className="truncate text-xs text-ink/55">{detail}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading dashboard">
      <div className="grid overflow-hidden rounded-md border border-line bg-white sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-[82px] animate-pulse border-line bg-ink/[0.035] sm:border-r" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-md border border-line bg-white" />
    </div>
  );
}

export function DashboardPage() {
  const { profile } = useAccess();
  const dashboard = useDashboard();
  const snapshot = dashboard.data;
  const scopeLabel = profile.branchIds.length
    ? `${profile.branchIds.length} assigned ${profile.branchIds.length === 1 ? "branch" : "branches"}`
    : "Organization-wide";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader
          eyebrow="Dashboard"
          title="Operations overview"
          description="Live membership and workforce totals within your access scope."
        />
        <div className="mb-3 flex items-center gap-2 text-xs text-ink/55">
          <span>{roleLabel(profile.role)}</span>
          <span aria-hidden="true">/</span>
          <span>{scopeLabel}</span>
        </div>
      </div>

      {dashboard.isLoading ? <LoadingState /> : null}

      {dashboard.isError ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-md border border-line bg-white p-6 text-center">
          <p className="text-sm font-semibold text-ink">Dashboard data could not be loaded.</p>
          <p className="mt-1 text-xs text-ink/55">Check the data connection and try again.</p>
          <button
            type="button"
            onClick={() => dashboard.refetch()}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-paper"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </section>
      ) : null}

      {snapshot ? (
        <div className="space-y-4">
          <section className="grid overflow-hidden rounded-md border border-line bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4 sm:[&>*]:border-r sm:[&>*:nth-child(2)]:border-r-0 xl:[&>*:nth-child(2)]:border-r xl:[&>*:last-child]:border-r-0 [&>*]:border-b [&>*]:border-line sm:[&>*:nth-last-child(-n+2)]:border-b-0 xl:[&>*]:border-b-0">
            <Metric label="Members" value={snapshot.totalMembers} detail={`${snapshot.activeMembers.toLocaleString()} active`} icon={<Users className="h-4 w-4" />} />
            <Metric label="Pending BOD" value={snapshot.pendingApprovals} detail="awaiting approval" icon={<ClipboardCheck className="h-4 w-4" />} />
            <Metric label="Employees" value={snapshot.totalEmployees} detail={`${snapshot.activeEmployees.toLocaleString()} active`} icon={<UserCheck className="h-4 w-4" />} />
            <Metric label="Client deployed" value={snapshot.clientDeployed} detail={`${snapshot.directEmployees.toLocaleString()} direct`} icon={<Building2 className="h-4 w-4" />} />
          </section>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
            <section className="min-w-0 overflow-hidden rounded-md border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Workforce by office / branch</h3>
                  <p className="mt-0.5 text-xs text-ink/50">Current employee placement</p>
                </div>
                <span className="text-xs font-medium text-ink/50">{snapshot.workforceByBranch.length} locations</span>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[560px] table-auto text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[#f7f8f6] text-[11px] uppercase text-ink/50">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Office / branch</th>
                      <th className="w-20 px-3 py-2.5 text-right font-semibold">Total</th>
                      <th className="w-20 px-3 py-2.5 text-right font-semibold">Active</th>
                      <th className="w-24 px-3 py-2.5 text-right font-semibold">At clients</th>
                      <th className="w-20 px-4 py-2.5 text-right font-semibold">Direct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {snapshot.workforceByBranch.map((branch) => (
                      <tr key={branch.branchId} className="hover:bg-paper/70">
                        <td className="px-4 py-3 font-medium text-ink">{branch.branchLabel}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink/65">{branch.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink/65">{branch.active}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink/65">{branch.clientDeployed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink/65">{branch.direct}</td>
                      </tr>
                    ))}
                    {!snapshot.workforceByBranch.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/50">No current branch assignments in your scope.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-line bg-white shadow-sm">
              <div className="border-b border-line px-4 py-3">
                <h3 className="text-sm font-semibold text-ink">Membership status</h3>
                <p className="mt-0.5 text-xs text-ink/50">Current member records</p>
              </div>
              <div className="divide-y divide-line px-4">
                {snapshot.membershipStatuses.map((status) => {
                  const percentage = snapshot.totalMembers
                    ? Math.round((status.count / snapshot.totalMembers) * 100)
                    : 0;
                  return (
                    <div key={status.key} className="py-3.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-ink/70">
                          <span className={`h-2 w-2 rounded-full ${statusStyles[status.key]}`} />
                          {status.label}
                        </span>
                        <span className="font-semibold tabular-nums text-ink">
                          {status.count.toLocaleString()}
                          <span className="ml-1.5 text-xs font-normal text-ink/45">{percentage}%</span>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                        <div className={`h-full rounded-full ${statusStyles[status.key]}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 border-t border-line bg-[#f7f8f6] px-4 py-3 text-xs text-ink/55">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Counts reflect your current access scope.
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
