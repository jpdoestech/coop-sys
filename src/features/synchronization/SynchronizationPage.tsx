import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudCog, Database, Eye, EyeOff, History, RefreshCcw, Save, Server, ShieldCheck, TestTube2, Wifi, WifiOff } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useAccess } from "../../services/access/useAccess";
import { getServerSyncStatus, runServerSync, saveServerSyncConfig, testServerSyncConnection, usesServerBackend, type ServerSyncStatus } from "../../services/server/syncApi";

type View = "activity" | "conflicts";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function statusTone(value: string) {
  return value === "completed" ? "bg-emerald-50 text-emerald-700" : value === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
}

function storageLabel(key: string) {
  return ({ coop_sys_members: "Members", coop_sys_employees: "Employees", coop_sys_organization_directory: "Organization", coop_sys_payment_ledger: "Payments" } as Record<string, string>)[key] ?? key;
}

export function SynchronizationPage() {
  const online = useOnlineStatus();
  const databaseBuild = usesServerBackend();
  const { can } = useAccess();
  const canManage = can("sync.manage");
  const [status, setStatus] = useState<ServerSyncStatus | null>(null);
  const [view, setView] = useState<View>("activity");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<"save" | "sync" | "test" | "refresh" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async (showBusy = false) => {
    if (!databaseBuild) return;
    if (showBusy) setBusy("refresh");
    try { setStatus(await getServerSyncStatus()); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Synchronization status could not be loaded." }); }
    finally { if (showBusy) setBusy(null); }
  }, [databaseBuild]);

  useEffect(() => {
    void load();
    if (!databaseBuild) return;
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [databaseBuild, load]);

  async function save() {
    if (!status) return;
    setBusy("save"); setNotice(null);
    try {
      setStatus(await saveServerSyncConfig({ deploymentMode: status.deploymentMode, autoSync: status.autoSync, syncIntervalMinutes: status.syncIntervalMinutes, remoteUrl: status.remoteUrl, replicationKey: status.replicationKey }));
      setNotice({ tone: "success", text: "Synchronization settings were saved on the host." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Settings could not be saved." }); }
    finally { setBusy(null); }
  }

  async function testConnection() {
    setBusy("test"); setNotice(null);
    try {
      const result = await testServerSyncConnection({ remoteUrl: status?.remoteUrl ?? "", replicationKey: status?.replicationKey ?? "" });
      setNotice({ tone: "success", text: `Connected to ${result.database} (${result.deploymentMode}).` });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "The remote host could not be reached." }); }
    finally { setBusy(null); }
  }

  async function synchronize() {
    setBusy("sync"); setNotice(null);
    try {
      const result = await runServerSync();
      setNotice({ tone: "success", text: `Sync completed: ${result.recordsSent} groups sent, ${result.recordsReceived} updated locally, ${result.conflictsDetected} conflicts resolved.` });
      await load();
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Synchronization failed. Local data was retained." }); }
    finally { setBusy(null); }
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader eyebrow="Synchronization" title="Sync center" description="Manage host replication and inspect data movement." />
      {databaseBuild ? <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void load(true)}><RefreshCcw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh</button> : null}
    </div>

    {!databaseBuild ? <div className="flex items-start gap-3 rounded-md border border-line bg-white p-4 text-sm text-ink/65 shadow-sm"><Database className="mt-0.5 h-4 w-4 shrink-0 text-moss" /><span>This browser-local edition does not have a shared synchronization host. Build with <strong>build-database-exe.bat</strong> to use SQLite WAL, LAN access, and hybrid synchronization.</span></div> : null}

    {databaseBuild && status ? <>
      <section className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-white shadow-sm xl:grid-cols-5">
        {[
          { label: "Host", value: online ? "Reachable" : "Offline", detail: online ? "Browser connected" : "LAN records remain available", icon: online ? Wifi : WifiOff, tone: online ? "text-emerald-700" : "text-amber-700" },
          { label: "Mode", value: status.deploymentMode === "HYBRID" ? "Hybrid" : "LAN only", detail: status.autoSync ? `Every ${status.syncIntervalMinutes} min` : "Automatic sync off", icon: CloudCog, tone: "text-moss" },
          { label: "Pending", value: status.counts.pending, detail: "Records waiting", icon: RefreshCcw, tone: status.counts.pending ? "text-amber-700" : "text-emerald-700" },
          { label: "Conflicts", value: status.counts.conflicts, detail: `${status.recentConflicts.length} recent decisions`, icon: AlertTriangle, tone: status.counts.conflicts ? "text-red-700" : "text-ink/55" },
          { label: "Last sync", value: status.latest?.status ?? "Not run", detail: formatDate(status.latest?.completed_at), icon: History, tone: status.latest?.status === "failed" ? "text-red-700" : "text-emerald-700" },
        ].map((metric) => <div key={metric.label} className={`flex min-w-0 items-center gap-2.5 border-b border-line px-3 py-2.5 odd:border-r xl:col-span-1 xl:border-b-0 xl:border-r xl:px-4 xl:py-3 xl:last:border-r-0 ${metric.label === "Last sync" ? "col-span-2" : ""}`}><metric.icon className={`h-4 w-4 shrink-0 ${metric.tone}`} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-ink/40">{metric.label}</p><p className="truncate text-sm font-semibold capitalize text-ink">{metric.value}</p><p className="truncate text-[11px] text-ink/45">{metric.detail}</p></div></div>)}
      </section>

      <section className="mt-3 overflow-hidden rounded-md border border-line bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold"><Server className="h-4 w-4 text-moss" /> Host deployment <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-normal text-ink/45"><ShieldCheck className="h-3.5 w-3.5" /> {canManage ? "Manage access" : "Read only"}</span></div>
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[10rem_minmax(18rem,1fr)_8rem_minmax(14rem,0.8fr)]">
          <label className="field-label">Mode<select className="compact-control mt-1 w-full" value={status.deploymentMode} disabled={!canManage} onChange={(event) => setStatus({ ...status, deploymentMode: event.target.value as "LAN_ONLY" | "HYBRID", autoSync: event.target.value === "HYBRID" && status.autoSync })}><option value="LAN_ONLY">LAN only</option><option value="HYBRID">Hybrid</option></select></label>
          <label className="field-label">Remote host URL<input className="compact-control mt-1 w-full" placeholder="https://records.example.com" value={status.remoteUrl} disabled={!canManage || status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, remoteUrl: event.target.value })} /></label>
          <label className="field-label">Interval<input className="compact-control mt-1 w-full" type="number" min={1} max={1440} value={status.syncIntervalMinutes} disabled={!canManage || status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, syncIntervalMinutes: Number(event.target.value) })} /></label>
          <label className="field-label">Replication key<span className="relative mt-1 block"><input className="compact-control w-full pr-9 font-mono text-xs" type={showKey ? "text" : "password"} value={status.replicationKey} disabled={!canManage || status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, replicationKey: event.target.value })} /><button type="button" className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-ink/45 hover:text-ink disabled:opacity-40" disabled={!canManage || status.deploymentMode !== "HYBRID"} onClick={() => setShowKey((current) => !current)} aria-label={showKey ? "Hide replication key" : "Show replication key"}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
          <label className="mr-auto flex items-center gap-2 text-xs text-ink/65"><input type="checkbox" checked={status.autoSync} disabled={!canManage || status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, autoSync: event.target.checked })} /> Automatic synchronization</label>
          {canManage ? <><button type="button" className="secondary-button" disabled={Boolean(busy) || status.deploymentMode !== "HYBRID" || !status.remoteUrl} onClick={() => void testConnection()}><TestTube2 className="h-4 w-4" />{busy === "test" ? "Testing..." : "Test connection"}</button><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void save()}><Save className="h-4 w-4" />{busy === "save" ? "Saving..." : "Save"}</button><button type="button" className="primary-button" disabled={Boolean(busy) || status.deploymentMode !== "HYBRID" || !status.remoteUrl} onClick={() => void synchronize()}><RefreshCcw className={`h-4 w-4 ${busy === "sync" || status.running ? "animate-spin" : ""}`} />{busy === "sync" || status.running ? "Synchronizing..." : "Sync now"}</button></> : null}
        </div>
        {notice ? <div className={`flex items-center gap-2 border-t px-3 py-2 text-xs ${notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : notice.tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-line bg-paper text-ink/65"}`}>{notice.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}</div> : null}
      </section>

      <section className="mt-3 overflow-hidden rounded-md border border-line bg-white shadow-sm">
        <div className="flex items-center gap-1 border-b border-line px-3 pt-2">
          <button type="button" className={`inline-flex h-9 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition ${view === "activity" ? "border-moss text-moss" : "border-transparent text-ink/55 hover:text-ink"}`} onClick={() => setView("activity")}><History className="h-4 w-4" /> Activity</button>
          <button type="button" className={`inline-flex h-9 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition ${view === "conflicts" ? "border-moss text-moss" : "border-transparent text-ink/55 hover:text-ink"}`} onClick={() => setView("conflicts")}><AlertTriangle className="h-4 w-4" /> Conflicts <span className="rounded bg-paper px-1.5 text-[10px]">{status.recentConflicts.length}</span></button>
        </div>
        {view === "activity" ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#f6f8f6] text-[10px] uppercase text-ink/45"><tr><th className="px-3 py-2">Started</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Sent</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Conflicts</th><th className="px-3 py-2">Result</th></tr></thead><tbody className="divide-y divide-line">{status.history.map((item) => <tr key={item.id} className="hover:bg-[#fafcfb]"><td className="whitespace-nowrap px-3 py-2">{formatDate(item.started_at)}</td><td className="px-3 py-2"><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>{item.status}</span></td><td className="px-3 py-2 text-right font-mono">{item.records_sent}</td><td className="px-3 py-2 text-right font-mono">{item.records_received}</td><td className="px-3 py-2 text-right font-mono">{item.conflicts_detected}</td><td className="max-w-sm truncate px-3 py-2 text-ink/55">{item.message ?? "-"}</td></tr>)}</tbody></table>{!status.history.length ? <p className="p-8 text-center text-sm text-ink/45">No synchronization runs yet.</p> : null}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-[#f6f8f6] text-[10px] uppercase text-ink/45"><tr><th className="px-3 py-2">Detected</th><th className="px-3 py-2">Data group</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Current modified</th><th className="px-3 py-2">Incoming modified</th><th className="px-3 py-2">Decision</th></tr></thead><tbody className="divide-y divide-line">{status.recentConflicts.map((item) => <tr key={item.id} className="hover:bg-[#fafcfb]"><td className="whitespace-nowrap px-3 py-2">{formatDate(item.created_at)}</td><td className="px-3 py-2 font-medium">{storageLabel(item.storage_key)}</td><td className="px-3 py-2 font-mono text-[11px]">{item.record_key}</td><td className="whitespace-nowrap px-3 py-2">{formatDate(item.current_updated_at)}</td><td className="whitespace-nowrap px-3 py-2">{formatDate(item.incoming_updated_at)}</td><td className="px-3 py-2 font-medium">{item.resolution.replace("_", " ")}</td></tr>)}</tbody></table>{!status.recentConflicts.length ? <p className="p-8 text-center text-sm text-ink/45">No conflict decisions have been recorded.</p> : null}</div>}
      </section>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{status.storageGroups.map((group) => <div key={group.storageKey} className="rounded-md border border-line bg-white px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{storageLabel(group.storageKey)}</span><span className="font-mono text-[10px] text-ink/45">rev {group.revision}</span></div><p className="mt-1 text-[11px] text-ink/45">Updated {formatDate(group.modifiedAt)}</p></div>)}</div>
    </> : null}
  </div>;
}
