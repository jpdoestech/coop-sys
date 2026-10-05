import { PageHeader } from "../../components/ui/PageHeader";
import { useAccess } from "../../services/access/useAccess";
import { DataMaintenance } from "./components/DataMaintenance";

export function SettingsPage() {
  const { profile } = useAccess();
  return (
    <div className="space-y-4"><PageHeader
      eyebrow="Settings"
      title="System settings"
    />{profile.role === "super_admin" ? <DataMaintenance /> : null}</div>
  );
}
