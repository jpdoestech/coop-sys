import { useMemo, useState } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { FinalPaySettlement, MemberPayment } from "../../../types/payment";
import { employeeFullName } from "../../../services/imports/identityMatching";
import { formatPesos } from "../../../services/payments/paymentMath";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { SettlementInput } from "../../../services/repositories/PaymentRepository";

export function FinalPayPanel({ employees, payments, settlements, userId, saving, onSettle }: { employees: Employee[]; payments: MemberPayment[]; settlements: FinalPaySettlement[]; userId: string; saving: boolean; onSettle: (input: SettlementInput) => void }) {
  const eligible = employees.filter((employee) => employee.member_id && employee.employment_status_id && terminalEmploymentStatuses.has(employee.employment_status_id) && !settlements.some((item) => item.employee_id === employee.id));
  const [employeeId, setEmployeeId] = useState("");
  const [refundFee, setRefundFee] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const employee = eligible.find((item) => item.id === employeeId);
  const totals = useMemo(() => payments.filter((item) => item.member_id === employee?.member_id).reduce((sum, item) => ({ fee: sum.fee + item.membership_fee_centavos, capital: sum.capital + item.capital_share_centavos }), { fee: 0, capital: 0 }), [payments, employee]);
  function submit(event: React.FormEvent) { event.preventDefault(); if (!employee?.member_id) return; if (window.confirm(`Create final-pay refund of ${formatPesos(totals.capital + (refundFee ? totals.fee : 0))}? This settlement cannot be posted twice.`)) onSettle({ employee_id: employee.id, member_id: employee.member_id, refund_membership_fee: refundFee, settlement_date: date, remarks: remarks || null, created_by: userId }); }
  return <form onSubmit={submit} className="grid gap-3 p-4 lg:grid-cols-6">
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 lg:col-span-6"><ShieldAlert className="h-4 w-4 shrink-0" /> Only resigned or terminated employees are eligible. Capital share contributions are returned in full; returning the membership fee is an explicit user decision.</div>
    <label className="field-label lg:col-span-3">Separated member / employee<select className="control mt-1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Select employee</option>{eligible.map((item) => <option key={item.id} value={item.id}>{item.employee_number} - {employeeFullName(item)} ({item.date_separated ?? "date not set"})</option>)}</select></label>
    <label className="field-label">Settlement date<input className="control mt-1" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <label className="field-label lg:col-span-2">Remarks<input className="control mt-1" maxLength={200} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
    <div className="rounded-md border border-line p-3 text-sm lg:col-span-2"><p className="text-xs text-ink/50">Capital share refund</p><p className="mt-1 font-semibold">{formatPesos(totals.capital)}</p></div>
    <label className="flex items-center gap-3 rounded-md border border-line p-3 text-sm lg:col-span-2"><input type="checkbox" checked={refundFee} onChange={(e) => setRefundFee(e.target.checked)} /><span><span className="block font-medium">Return membership fee</span><span className="text-xs text-ink/50">{formatPesos(totals.fee)}</span></span></label>
    <div className="rounded-md bg-emerald-50 p-3 text-sm lg:col-span-2"><p className="text-xs text-moss/70">Total final-pay refund</p><p className="mt-1 font-bold text-moss">{formatPesos(totals.capital + (refundFee ? totals.fee : 0))}</p></div>
    <button disabled={!employee || saving} className="primary-button w-fit lg:col-span-6"><RotateCcw className="h-4 w-4" /> {saving ? "Settling..." : "Create final-pay settlement"}</button>
  </form>;
}
