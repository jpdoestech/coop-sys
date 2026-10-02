import { serverRequest, usesServerBackend } from "./serverApi";

export type ServerSyncStatus = {
  deploymentMode: "LAN_ONLY" | "HYBRID";
  autoSync: boolean;
  syncIntervalMinutes: number;
  remoteUrl: string;
  replicationKey: string;
  configured: boolean;
  latest: null | {
    status: string;
    records_processed: number;
    message: string | null;
    started_at: string;
    completed_at: string | null;
  };
};

export { usesServerBackend };
export function getServerSyncStatus() { return serverRequest<ServerSyncStatus>("/sync/status"); }
export function saveServerSyncConfig(input: Omit<ServerSyncStatus, "configured" | "latest">) { return serverRequest<ServerSyncStatus>("/sync/config", { method: "PUT", body: JSON.stringify(input) }); }
export function runServerSync() { return serverRequest<{ status: string; recordsProcessed: number; completedAt: string }>("/sync/run", { method: "POST" }); }
