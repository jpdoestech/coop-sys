export type AppMode = "ONLINE" | "OFFLINE" | "AUTO";

export function getAppMode(): AppMode {
  const mode = import.meta.env.VITE_APP_MODE;

  if (mode === "ONLINE" || mode === "OFFLINE" || mode === "AUTO") {
    return mode;
  }

  return "AUTO";
}
