import { Building2, RefreshCcw, UserCheck, Users } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";

const recentChanges = [
  "Member MEM-000014 updated contact details",
  "Employee EMP-000006 assigned to Operations",
  "Department Finance marked active",
  "Sync queue checked with no conflicts"
];

export function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Records overview"
        description="A compact operating view of membership, employees, departments, and synchronization health."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value="50" detail="Seed baseline" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active members" value="44" detail="6 inactive or archived" icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Total employees" value="20" detail="Across 5 departments" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Pending sync" value="0" detail="No queued changes" icon={<RefreshCcw className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border border-line bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Employees by department</h3>
          <div className="mt-4 space-y-3">
            {[
              ["Operations", 7],
              ["Member Services", 5],
              ["Finance", 4],
              ["Administration", 3],
              ["Information Systems", 1]
            ].map(([label, count]) => (
              <div key={label}>
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#ece6dc]">
                  <div className="h-2 rounded-full bg-moss" style={{ width: `${Number(count) * 12}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Recent changes</h3>
          <ul className="mt-4 space-y-3">
            {recentChanges.map((change) => (
              <li key={change} className="rounded-md border border-line bg-paper px-3 py-2 text-sm">
                {change}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
