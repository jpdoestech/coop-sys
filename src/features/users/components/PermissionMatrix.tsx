import { Check, Minus } from "lucide-react";
import { permissionModules, type Permission } from "../../../services/access/accessControl";

type Props = { value: Permission[]; onChange?: (value: Permission[]) => void; disabled?: boolean; compact?: boolean };

export function PermissionMatrix({ value, onChange, disabled, compact }: Props) {
  const selected = new Set(value);
  const actions = ["view", "create", "update", "delete", "import", "export", "approve", "manage"];
  function toggle(permission: Permission) {
    if (!onChange || disabled) return;
    onChange(selected.has(permission) ? value.filter((item) => item !== permission) : [...value, permission]);
  }
  return (
    <div className="overflow-auto rounded-md border border-line">
      <table className="w-full min-w-[760px] table-fixed text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[#f6f8f6] text-[10px] uppercase text-ink/50">
          <tr><th className="w-56 px-3 py-2">Module</th>{actions.map((action) => <th key={action} className="px-1 py-2 text-center">{action}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {permissionModules.map((module) => (
            <tr key={module.id} className="hover:bg-[#fafcfb]">
              <td className={`px-3 font-medium ${compact ? "py-1.5" : "py-2"}`}>{module.label}</td>
              {actions.map((action) => {
                const definition = module.actions.find((item) => item.action === action);
                if (!definition) return <td key={action} className="px-1 text-center text-ink/20"><Minus className="mx-auto h-3 w-3" /></td>;
                const checked = selected.has(definition.permission);
                return <td key={action} className="px-1 text-center"><button type="button" disabled={disabled} onClick={() => toggle(definition.permission)} title={`${definition.label} ${module.label}`} className={`mx-auto grid h-6 w-6 place-items-center rounded border transition ${checked ? "border-moss bg-moss text-white" : "border-line bg-white text-transparent hover:border-moss/60"} disabled:cursor-default`}><Check className="h-3.5 w-3.5" /></button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
