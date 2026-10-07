import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

type Props = { label: string; percentage?: number; completed?: number; total?: number; startedAt?: number; className?: string };

export function LoadingProgress({ label, percentage, completed, total, startedAt, className = "" }: Props) {
  const [mountedAt] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (percentage !== undefined) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [percentage]);
  const estimated = percentage === undefined;
  const value = estimated ? Math.min(90, Math.round(5 + 85 * (1 - Math.exp(-Math.max(0, clock - (startedAt ?? mountedAt)) / 15000)))) : Math.max(0, Math.min(100, Math.floor(percentage)));
  return <div role="status" className={`mx-auto w-full max-w-sm min-w-0 text-xs ${className}`}>
    <div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-moss motion-reduce:animate-none" /><span className="break-words">{label}</span></span><span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-ink/60">{estimated ? "Estimated " : ""}{value}%</span></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={estimated ? undefined : value} aria-valuetext={`${estimated ? "Estimated " : ""}${value}%`} className="mt-2 h-1 overflow-hidden rounded bg-moss/10"><div className="h-full bg-moss transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value}%` }} /></div>
    {completed !== undefined && total !== undefined ? <p className="mt-1 text-[10px] text-ink/50">{completed.toLocaleString()} / {total.toLocaleString()} processed</p> : null}
  </div>;
}
