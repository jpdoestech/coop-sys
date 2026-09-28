import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, detail, icon }: StatCardProps) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink/65">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
        </div>
        {icon ? <div className="rounded-md bg-[#ece6dc] p-2 text-moss">{icon}</div> : null}
      </div>
      {detail ? <p className="mt-3 text-xs text-ink/60">{detail}</p> : null}
    </section>
  );
}
