export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "conflict";

export type BaseRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
};

export type PersonName = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
};
