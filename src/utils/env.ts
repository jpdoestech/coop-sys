export type AppMode = "ONLINE" | "OFFLINE" | "AUTO";

type AppEnvironment = {
  VITE_APP_MODE?: string;
  PROD?: boolean;
};

export function getAppMode(environment: AppEnvironment = import.meta.env): AppMode {
  const mode = environment.VITE_APP_MODE;

  if (mode === "ONLINE" || mode === "OFFLINE" || mode === "AUTO") {
    return mode;
  }

  // Hosted production must fail closed when cloud configuration is missing.
  // Offline distributions always set VITE_APP_MODE=OFFLINE during their build.
  return environment.PROD ? "ONLINE" : "AUTO";
}
