import { ArrowRightLeft, Building2, MapPin, X } from "lucide-react";
import type { EmploymentAssignmentInput } from "../../../types/assignment";
import { HEAD_OFFICE_ID, labelFor } from "../data/employeeOptions";
import { useOrganization } from "../../../services/organization/useOrganization";

type Props = {
  value: EmploymentAssignmentInput | null;
  history: EmploymentAssignmentInput[];
  existingActive: EmploymentAssignmentInput | null;
  transferring: boolean;
  onChange: (value: EmploymentAssignmentInput | null) => void;
  onBeginTransfer: () => void;
  onCancelTransfer: () => void;
};

const inputClass =
  "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink disabled:bg-line/20 disabled:text-ink/55";

function placementName(assignment: EmploymentAssignmentInput, branches: Array<{ id: string; label: string }>, clients: Array<{ id: string; label: string; branchId: string; isActive: boolean }>) {
  const branch = labelFor(branches, assignment.branch_id);
  const clientOptions = clients.filter((item) => item.branchId === assignment.branch_id && item.isActive);
  const client = clientOptions.find((item) => item.id === assignment.client_id)?.label;
  return client ? `${branch} / ${client}` : branch;
}

export function AssignmentEditor({ value, history, existingActive, transferring, onChange, onBeginTransfer, onCancelTransfer }: Props) {
  const { branches, clients } = useOrganization();
  const availableClients = clients.filter((item) => item.branchId === value?.branch_id && item.isActive);
  const showEditor = !existingActive || transferring;

  return (
    <div className="sm:col-span-2 space-y-4">
      {existingActive && !transferring ? (
        <div className="flex flex-col gap-3 border-l-4 border-moss bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Building2 className="h-4 w-4 text-moss" />{placementName(existingActive, branches, clients)}</p>
            <p className="mt-1 text-xs text-ink/55">Since {existingActive.start_date}{existingActive.work_location ? ` / ${existingActive.work_location}` : ""}</p>
          </div>
          <button type="button" className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-moss px-3 py-2 text-sm font-semibold text-moss hover:bg-moss/5" onClick={onBeginTransfer}>
            <ArrowRightLeft className="h-4 w-4" /> Transfer employee
          </button>
        </div>
      ) : null}

      {showEditor && value ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-ink/75">
            Office / branch
            <select className={inputClass} value={value.branch_id ?? ""} onChange={(event) => {
              const branchId = event.target.value || null;
              const branch = branches.find((item) => item.id === branchId);
              onChange({ ...value, branch_id: branchId, client_id: null, work_location: branch?.label ?? null });
            }}>
              <option value="">Not assigned</option>
              {branches.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.type === "head_office" ? item.label : `Branch: ${item.label}`}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink/75">
            Branch client
            <select className={inputClass} disabled={!value.branch_id || value.branch_id === HEAD_OFFICE_ID} value={value.client_id ?? ""} onChange={(event) => onChange({ ...value, client_id: event.target.value || null })}>
              <option value="">Direct office / branch employee</option>
              {availableClients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink/75">
            Assignment code
            <input className={inputClass} value={value.assignment_code ?? ""} onChange={(event) => onChange({ ...value, assignment_code: event.target.value || null })} />
          </label>
          <label className="block text-xs font-semibold text-ink/75">
            {transferring ? "Transfer effective date" : "Start date"}
            <input type="date" className={inputClass} value={value.start_date} onChange={(event) => onChange({ ...value, start_date: event.target.value })} />
          </label>
          {transferring ? (
            <label className="block text-xs font-semibold text-ink/75 sm:col-span-2">
              Transfer reason
              <input className={inputClass} value={value.transfer_reason ?? ""} onChange={(event) => onChange({ ...value, transfer_reason: event.target.value || null })} />
            </label>
          ) : null}
          <label className="block text-xs font-semibold text-ink/75 sm:col-span-2">
            Work location
            <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-ink/40" /><input className={`${inputClass} pl-9`} value={value.work_location ?? ""} onChange={(event) => onChange({ ...value, work_location: event.target.value || null })} /></div>
          </label>
          {transferring ? (
            <div className="sm:col-span-2 flex justify-end">
              <button type="button" className="focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-white" onClick={onCancelTransfer}><X className="h-4 w-4" /> Cancel transfer</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length ? (
        <div className="border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase text-ink/45">Placement history</p>
          <div className="mt-2 divide-y divide-line border-y border-line">
            {history.map((assignment) => (
              <div key={assignment.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div><p className="font-semibold text-ink">{placementName(assignment, branches, clients)}</p><p className="mt-0.5 text-xs text-ink/55">{assignment.assignment_code ?? "No assignment code"}{assignment.transfer_reason ? ` / ${assignment.transfer_reason}` : ""}</p></div>
                <p className="font-mono text-xs text-ink/55">{assignment.start_date} to {assignment.end_date ?? "Present"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

