import type { AccessProfile } from "../access/accessControl";
import type { DashboardSnapshot } from "../../types/dashboard";

export interface DashboardRepository {
  getSnapshot(profile: AccessProfile): Promise<DashboardSnapshot>;
}
