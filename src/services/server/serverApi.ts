const SERVER_BACKEND = import.meta.env.VITE_DATA_BACKEND === "SERVER";

export function usesServerBackend() {
  return SERVER_BACKEND;
}

export async function serverRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? payload.error
      : `Server request failed (${response.status}).`;
    throw new Error(message || "Server request failed.");
  }
  return payload as T;
}
