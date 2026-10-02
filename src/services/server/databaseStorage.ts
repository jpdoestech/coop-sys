import { serverRequest, usesServerBackend } from "./serverApi";

const SERVER_KEYS = [
  "coop_sys_members",
  "coop_sys_employees",
  "coop_sys_organization_directory",
  "coop_sys_payment_ledger",
] as const;

let pending = Promise.resolve();

export async function hydrateDatabaseStorage() {
  if (!usesServerBackend()) return;
  const records = await serverRequest<Record<string, string>>("/storage");
  SERVER_KEYS.forEach((key) => {
    const value = records[key];
    if (typeof value === "string") localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  });
}

export function readPersistentItem(key: string) {
  return localStorage.getItem(key);
}

export function writePersistentItem(key: string, value: string) {
  localStorage.setItem(key, value);
  if (!usesServerBackend() || !SERVER_KEYS.includes(key as typeof SERVER_KEYS[number])) return;
  pending = pending
    .catch(() => undefined)
    .then(() => serverRequest<{ value: string }>(`/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }))
    .then((result) => { if (typeof result.value === "string") localStorage.setItem(key, result.value); });
}

export function flushDatabaseStorage() {
  return pending;
}
