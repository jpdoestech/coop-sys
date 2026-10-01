import { useMemo, useState } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { FinalPaySettlement, MemberPayment } from "../../../types/payment";
import { formatPesos } from "../../../services/payments/paymentMath";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { SettlementInput } from "../../../services/repositories/PaymentRepository";
import { EmployeeSearchField } from "./EmployeeSearchField";

export function FinalPayPanel({ employees, payments, settlements, userId, saving, onSettle }: { employees: Employee[]; payments: MemberPayment[]; settlements: FinalPaySettlement[]; userId: string; saving: boolean; onSettle: (input: SettlementInput) => void }) {
  const eligible = employees.filter((employee) => employee.member_id && employee.employment_status_id && terminalEmploymentStatuses.has(employee.employment_status_id) && !settlements.some((item) => item.employee_id === employee.id));
  const [employeeId, setEmployeeId] = useState("");
  const [refundFee, setRefundFee] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const employee = eligible.find((item) => item.id === employeeId);
  const totals = useMemo(() => payments.filter((item) => item.member_id === employee?.member_id).reduce((sum, item) => ({ fee: sum.fee + item.membership_fee_centavos, capital: sum.capital + item.capital_share_centavos }), { fee: 0, capital: 0 }), [payments, employee]);
  function submit(event: React.FormEvent) { event.preventDefault(); if (!employee?.member_id) return; if (window.confirm(`Create final-pay refund of ${formatPesos(totals.capital + (refundFee ? totals.fee : 0))}? This settlement cannot be posted twice.`)) onSettle({ employee_id: employee.id, member_id: employee.member_id, refund_membership_fee: refundFee, settlement_date: date, remarks: remarks || null, created_by: userId }); }
  return <div>
    <div className="flex items-center gap-3 border-b border-line bg-[#f8faf8] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e4efe9] text-moss"><RotateCcw className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Prepare final-pay settlement</h3><p className="text-[11px] text-ink/45">Search eligible separated employees and review refundable balances.</p></div></div>
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"><ShieldAlert className="h-4 w-4 shrink-0" /> Capital share is returned in full. Returning the membership fee remains an explicit decision.</div>
    <form onSubmit={submit} className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-12">
      <div className="lg:col-span-5"><EmployeeSearchField employees={eligible} value={employeeId} onChange={setEmployeeId} label="Separated member / employee" required placeholder="Type employee ID or name" emptyMessage="No eligible resigned or terminated employee matches your search." /></div>
      <label className="field-label lg:col-span-2">Settlement date<input className="control mt-1 w-full" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field-label lg:col-span-5">Remarks<input className="control mt-1 w-full" maxLength={200} placeholder="Optional settlement note" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
      <div className="border-y border-line py-3 lg:col-span-12"><div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="px-4 py-2"><p className="text-[10px] font-bold uppercase text-ink/40">Capital share refund</p><p className="mt-1 font-semibold">{formatPesos(totals.capital)}</p></div><label className="flex items-center gap-3 px-4 py-2 text-sm"><input type="checkbox" checked={refundFee} onChange={(e) => setRefundFee(e.target.checked)} /><span><span className="block text-xs font-semibold">Return membership fee</span><span className="text-[11px] text-ink/45">{formatPesos(totals.fee)}</span></span></label><div className="px-4 py-2"><p className="text-[10px] font-bold uppercase text-moss/70">Total refund</p><p className="mt-1 font-bold text-moss">{formatPesos(totals.capital + (refundFee ? totals.fee : 0))}</p></div></div></div>
      <div className="flex justify-end lg:col-span-12"><button disabled={!employee || saving} className="primary-button"><RotateCcw className="h-4 w-4" /> {saving ? "Settling..." : "Create final-pay settlement"}</button></div>
    </form>
  </div>;
}
