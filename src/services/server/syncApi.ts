import { serverRequest, usesServerBackend } from "./serverApi";

export type ServerSyncLog = {
  id?: string;
  status: string;
  records_processed: number;
  records_sent: number;
  records_received: number;
  conflicts_detected: number;
  message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type ServerSyncStatus = {
  deploymentMode: "LAN_ONLY" | "HYBRID";
  autoSync: boolean;
  syncIntervalMinutes: number;
  remoteUrl: string;
  replicationKey: string;
  configured: boolean;
  running: boolean;
  counts: { pending: number; conflicts: number; synced: number };
  storageGroups: Array<{ storageKey: string; revision: number; modifiedAt: string }>;
  latest: ServerSyncLog | null;
  history: Array<ServerSyncLog & { id: string }>;
  recentConflicts: Array<{
    id: string;
    storage_key: string;
    record_key: string;
    current_updated_at: string | null;
    incoming_updated_at: string | null;
    resolution: string;
    created_at: string;
  }>;
};
export type ServerSyncConfigInput = Pick<ServerSyncStatus, "deploymentMode" | "autoSync" | "syncIntervalMinutes" | "remoteUrl" | "replicationKey">;

export { usesServerBackend };
export function getServerSyncStatus() { return serverRequest<ServerSyncStatus>("/sync/status"); }
export function saveServerSyncConfig(input: ServerSyncConfigInput) { return serverRequest<ServerSyncStatus>("/sync/config", { method: "PUT", body: JSON.stringify(input) }); }
export function runServerSync() { return serverRequest<{ status: string; recordsProcessed: number; recordsSent: number; recordsReceived: number; conflictsDetected: number; completedAt: string }>("/sync/run", { method: "POST" }); }
export function testServerSyncConnection(input: Pick<ServerSyncConfigInput, "remoteUrl" | "replicationKey">) { return serverRequest<{ ok: boolean; database: string; deploymentMode: string }>("/sync/test", { method: "POST", body: JSON.stringify(input) }); }
