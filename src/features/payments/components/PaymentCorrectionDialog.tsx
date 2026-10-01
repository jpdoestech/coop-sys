import { AlertTriangle, Save, X } from "lucide-react";
import { useState } from "react";
import type { MemberPayment } from "../../../types/payment";
import type { PaymentCorrectionInput } from "../../../services/repositories/PaymentRepository";
import {
  formatPesos,
  pesosToCentavos,
} from "../../../services/payments/paymentMath";

type Props = {
  payment: MemberPayment;
  userId: string;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: PaymentCorrectionInput) => void;
};

export function PaymentCorrectionDialog({
  payment,
  userId,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const [amount, setAmount] = useState(
    (payment.amount_centavos / 100).toFixed(2),
  );
  const [remarks, setRemarks] = useState(payment.remarks ?? "");
  const [comment, setComment] = useState("");
  let nextAmount = 0;
  try {
    nextAmount = pesosToCentavos(amount);
  } catch {
    nextAmount = 0;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSave({
      payment_id: payment.id,
      amount_centavos: pesosToCentavos(amount),
      remarks: remarks.trim() || null,
      comment: comment.trim(),
      corrected_by: userId,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3">
      <form
        onSubmit={submit}
        className="w-full max-w-lg overflow-hidden rounded-md bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Edit transaction</h2>
            <p className="text-[11px] text-ink/45">
              The original value and correction comment remain in the audit
              history.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close correction"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 divide-x divide-line rounded-md border border-line bg-[#f8faf8]">
            <div className="p-3">
              <span className="block text-[10px] font-semibold uppercase text-ink/40">
                From
              </span>
              <strong className="mt-1 block font-mono text-sm">
                {formatPesos(payment.amount_centavos)}
              </strong>
            </div>
            <div className="p-3">
              <span className="block text-[10px] font-semibold uppercase text-ink/40">
                To
              </span>
              <strong className="mt-1 block font-mono text-sm text-moss">
                {nextAmount ? formatPesos(nextAmount) : "Invalid amount"}
              </strong>
            </div>
          </div>
          <label className="field-label">
            Correct amount (PHP)
            <input
              className="control mt-1 w-full font-mono"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="field-label">
            Transaction remarks
            <input
              className="control mt-1 w-full"
              maxLength={200}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </label>
          <label className="field-label">
            Correction comment
            <textarea
              className="control mt-1 min-h-24 w-full resize-y"
              required
              maxLength={500}
              placeholder="Explain why this payment is being changed"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {error ? (
            <p className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={saving || !nextAmount || !comment.trim()}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save correction"}
          </button>
        </footer>
      </form>
    </div>
  );
}
