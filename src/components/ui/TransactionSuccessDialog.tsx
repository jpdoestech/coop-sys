import { useEffect, useRef } from "react";
import { Check, CircleCheck } from "lucide-react";
import { useTransactionNotifications } from "../../services/activity/transactionNotifications";

export function TransactionSuccessDialog() {
  const notice = useTransactionNotifications((state) => state.notices[0]);
  const dismiss = useTransactionNotifications((state) => state.dismiss);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (notice && !dialog.current?.open) dialog.current?.showModal(); }, [notice]);
  if (!notice) return null;
  return <dialog ref={dialog} aria-labelledby="transaction-success-title" onCancel={(event) => { event.preventDefault(); dismiss(); }} className="m-auto w-[calc(100%_-_24px)] max-w-sm rounded-md border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/45">
    <div className="flex gap-3 p-4"><CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div className="min-w-0"><h2 id="transaction-success-title" className="text-sm font-semibold">{notice.title}</h2><p className="mt-1 break-words text-xs text-ink/65">{notice.message}</p><p className="mt-2 font-mono text-[11px] text-emerald-700">100% complete</p></div></div>
    <footer className="flex justify-end border-t border-line p-3"><button autoFocus type="button" className="primary-button" onClick={dismiss}><Check className="h-4 w-4" />Done</button></footer>
  </dialog>;
}
