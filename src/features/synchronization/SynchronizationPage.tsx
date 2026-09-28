import { RefreshCcw } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

export function SynchronizationPage() {
  const online = useOnlineStatus();

  return (
    <div>
      <PageHeader
        eyebrow="Synchronization"
        title="Sync center"
        description="Monitor local changes, conflicts, failed sync attempts, and server connectivity."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Connection" value={online ? "Online" : "Offline"} detail="Browser connectivity state" />
        <StatCard label="Pending changes" value="0" detail="Local queue" />
        <StatCard label="Conflicts" value="0" detail="No conflicts logged" />
        <StatCard label="Sync errors" value="0" detail="No failed attempts" />
      </div>
      <div className="mt-6 rounded-md border border-line bg-white p-5 shadow-sm">
        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white">
          <RefreshCcw className="h-4 w-4" />
          Sync Now
        </button>
        <p className="mt-4 text-sm text-ink/65">
          Last synchronized: Not yet synchronized. Failed sync attempts will retain local data and remain inspectable.
        </p>
      </div>
    </div>
  );
}
