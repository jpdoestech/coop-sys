import { useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Hash, X } from "lucide-react";

type Props = {
  count: number;
  resolutionNumber: string;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onApprove: (approvalDate: string) => void;
};

export function MemberApprovalDialog({ count, resolutionNumber, saving, error, onCancel, onApprove }: Props) {
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().slice(0, 10));

  function submit(event: FormEvent) {
    event.preventDefault();
    onApprove(approvalDate);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-md border border-line bg-white shadow-panel" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase text-moss">BOD approval</p><h2 id="approval-title" className="mt-1 text-lg font-semibold">Approve {count} member{count === 1 ? "" : "s"}</h2></div>
          <button type="button" onClick={onCancel} className="icon-button h-8 w-8" aria-label="Close approval"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block text-xs font-semibold text-ink/65"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Approval date</span><input required type="date" value={approvalDate} onChange={(event) => setApprovalDate(event.target.value)} className="control mt-1.5 w-full" /></label>
          <label className="block text-xs font-semibold text-ink/65"><span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> BOD resolution number</span><input readOnly value={resolutionNumber} className="control mt-1.5 w-full bg-paper font-mono" /></label>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-paper/50 px-5 py-3">
          <button type="button" onClick={onCancel} className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold"><X className="h-4 w-4" /> Cancel</button>
          <button disabled={saving} className="primary-button"><CheckCircle2 className="h-4 w-4" /> {saving ? "Approving..." : "Approve selected"}</button>
        </div>
      </form>
    </div>
  );
}
