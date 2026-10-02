import { useEffect, useState } from "react";
import { Database, RefreshCcw, Save, Server, Wifi } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { getServerSyncStatus, runServerSync, saveServerSyncConfig, usesServerBackend, type ServerSyncStatus } from "../../services/server/syncApi";

export function SynchronizationPage() {
  const online = useOnlineStatus();
  const databaseBuild = usesServerBackend();
  const [status, setStatus] = useState<ServerSyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!databaseBuild) return;
    void getServerSyncStatus().then(setStatus).catch((error: Error) => setMessage(error.message));
  }, [databaseBuild]);

  async function save() {
    if (!status) return;
    setBusy(true); setMessage("");
    try {
      setStatus(await saveServerSyncConfig({ deploymentMode: status.deploymentMode, autoSync: status.autoSync, syncIntervalMinutes: status.syncIntervalMinutes, remoteUrl: status.remoteUrl, replicationKey: status.replicationKey }));
      setMessage("Deployment settings saved on the host computer.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  }

  async function synchronize() {
    setBusy(true); setMessage("");
    try {
      const result = await runServerSync();
      setMessage(`Synchronization completed. ${result.recordsProcessed} record groups received.`);
      setStatus(await getServerSyncStatus());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Synchronization failed."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader eyebrow="Synchronization" title="Sync center" description="Manage the host database deployment and inspect the latest synchronization result." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Browser connection" value={online ? "Online" : "Offline"} detail="Current device connectivity" />
        <StatCard label="Data source" value={databaseBuild ? "Host database" : "This browser"} detail={databaseBuild ? "SQLite WAL through the server API" : "Browser-local storage"} />
        <StatCard label="Deployment" value={status?.deploymentMode === "HYBRID" ? "Hybrid" : "LAN only"} detail={status?.autoSync ? "Automatic sync enabled" : "Manual or no cloud sync"} />
        <StatCard label="Last result" value={status?.latest?.status ?? "Not run"} detail={status?.latest?.completed_at ? new Date(status.latest.completed_at).toLocaleString() : "No synchronization history"} />
      </div>

      {databaseBuild && status ? (
        <section className="mt-4 overflow-hidden rounded-md border border-line bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink"><Server className="h-4 w-4 text-moss" /> Host deployment</div>
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-ink/65">Mode
              <select className="focus-ring mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink" value={status.deploymentMode} onChange={(event) => setStatus({ ...status, deploymentMode: event.target.value as "LAN_ONLY" | "HYBRID", autoSync: event.target.value === "HYBRID" && status.autoSync })}>
                <option value="LAN_ONLY">LAN only</option><option value="HYBRID">Hybrid</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-ink/65 xl:col-span-2">Remote server URL
              <input className="focus-ring mt-1 h-10 w-full rounded-md border border-line px-3 text-sm" placeholder="https://records.example.com" value={status.remoteUrl} disabled={status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, remoteUrl: event.target.value })} />
            </label>
            <label className="text-xs font-semibold text-ink/65">Interval (minutes)
              <input className="focus-ring mt-1 h-10 w-full rounded-md border border-line px-3 text-sm" type="number" min={1} max={1440} value={status.syncIntervalMinutes} disabled={status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, syncIntervalMinutes: Number(event.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink md:col-span-2"><input type="checkbox" checked={status.autoSync} disabled={status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, autoSync: event.target.checked })} /> Automatically synchronize when the host has internet access</label>
            <label className="text-xs font-semibold text-ink/65 md:col-span-2">Replication key
              <input className="focus-ring mt-1 h-10 w-full rounded-md border border-line px-3 font-mono text-xs" value={status.replicationKey} disabled={status.deploymentMode !== "HYBRID"} onChange={(event) => setStatus({ ...status, replicationKey: event.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-moss px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void save()}><Save className="h-4 w-4" /> Save settings</button>
            <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink disabled:opacity-50" disabled={busy || status.deploymentMode !== "HYBRID" || !status.remoteUrl} onClick={() => void synchronize()}><RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Sync now</button>
            {message ? <span className="text-sm text-ink/65">{message}</span> : null}
          </div>
        </section>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-line bg-white p-4 text-sm text-ink/65 shadow-sm"><Database className="mt-0.5 h-4 w-4 text-moss" /><span>This edition stores records in the current browser. Build with <strong>build-database-exe.bat</strong> to use the shared host database.</span></div>
      )}
      {!online ? <div className="mt-3 flex items-center gap-2 text-xs text-ink/55"><Wifi className="h-4 w-4" /> LAN records remain available while internet access is unavailable.</div> : null}
    </div>
  );
}
