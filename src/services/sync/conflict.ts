import type { BaseRecord } from "../../types/common";

export type ConflictDecision = "local_wins" | "server_wins" | "same_timestamp";

export function chooseLastModifiedWinner(
  localRecord: Pick<BaseRecord, "updated_at">,
  serverRecord: Pick<BaseRecord, "updated_at">
): ConflictDecision {
  const localTime = Date.parse(localRecord.updated_at);
  const serverTime = Date.parse(serverRecord.updated_at);

  if (localTime > serverTime) return "local_wins";
  if (serverTime > localTime) return "server_wins";
  return "same_timestamp";
}
