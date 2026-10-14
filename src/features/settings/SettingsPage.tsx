import { PageHeader } from "../../components/ui/PageHeader";
import { useAccess } from "../../services/access/useAccess";
import { DataMaintenance } from "./components/DataMaintenance";
import { AttendancePreferencesControl } from "../payroll/AttendancePreferencesControl";

export function SettingsPage() {
  const { profile, can } = useAccess();
  return (
    <div className="space-y-4"><PageHeader
      eyebrow="Settings"
      title="System settings"
    />{can("payroll.view") ? <section className="border-b border-line bg-white p-4"><h2 className="mb-3 text-sm font-semibold">My attendance preferences</h2><div className="max-w-md"><AttendancePreferencesControl /></div></section> : null}{profile.role === "super_admin" ? <DataMaintenance /> : null}</div>
  );
}
