import { useMemo, useState } from "react";
import { Banknote, CalendarDays, Save } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import { pesosToCentavos } from "../../../services/payments/paymentMath";
import type { PaymentBatchInput, PaymentLineInput } from "../../../services/repositories/PaymentRepository";
import { EmployeeSearchField } from "./EmployeeSearchField";

type Props = { employees: Employee[]; branches: OrganizationBranch[]; clients: OrganizationClient[]; userId: string; saving: boolean; onPost: (batch: PaymentBatchInput, lines: PaymentLineInput[]) => void };

export function ManualPaymentPanel({ employees, branches, clients, userId, saving, onPost }: Props) {
  const [branchId, setBranchId] = useState("");
  const [clientId, setClientId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const scoped = useMemo(() => employees.filter((employee) => employee.member_id && employee.active_assignment?.branch_id === branchId && (!clientId || employee.active_assignment?.client_id === clientId)), [employees, branchId, clientId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const employee = scoped.find((item) => item.id === employeeId);
      if (!branchId || !employee?.member_id) throw new Error("Select a branch and a linked member/employee.");
      setError("");
      onPost({ branch_id: branchId, client_id: clientId || null, method: "manual", cutoff_from: null, cutoff_to: null, payroll_month: null, payment_date: paymentDate, source_file_name: null, remarks: remarks || null, created_by: userId }, [{ employee_id: employee.id, member_id: employee.member_id, amount_centavos: pesosToCentavos(amount), remarks: remarks || null }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Payment could not be prepared."); }
  }

  return <div>
    <div className="flex items-center gap-3 border-b border-line bg-[#f8faf8] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e4efe9] text-moss"><Banknote className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Record a member payment</h3><p className="text-[11px] text-ink/45">Select placement first, then search the employee by ID or name.</p></div></div>
    <form onSubmit={submit} className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-12">
      <label className="field-label lg:col-span-3">Branch<select className="control mt-1 w-full" required value={branchId} onChange={(e) => { setBranchId(e.target.value); setClientId(""); setEmployeeId(""); }}><option value="">Select branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="field-label lg:col-span-3">Client<select className="control mt-1 w-full" value={clientId} onChange={(e) => { setClientId(e.target.value); setEmployeeId(""); }}><option value="">Direct / all clients</option>{clients.filter((item) => item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="lg:col-span-4"><EmployeeSearchField employees={scoped} value={employeeId} onChange={setEmployeeId} label="Member / employee" required emptyMessage={branchId ? "No linked member/employee matches this placement." : "Select a branch before searching employees."} /></div>
      <label className="field-label lg:col-span-2">Payment date<div className="relative mt-1"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="control w-full pl-9" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div></label>
      <label className="field-label sm:col-span-1 lg:col-span-3">Amount (PHP)<input className="control mt-1 w-full font-mono" inputMode="decimal" placeholder="0.00" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="field-label sm:col-span-1 lg:col-span-7">Remarks<input className="control mt-1 w-full" maxLength={200} placeholder="Optional payment note" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
      <div className="flex items-end justify-end lg:col-span-2"><button disabled={saving} className="primary-button w-full"><Save className="h-4 w-4" /> {saving ? "Posting..." : "Post payment"}</button></div>
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2 lg:col-span-12">{error}</p> : <p className="flex items-center gap-2 text-[11px] text-ink/45 sm:col-span-2 lg:col-span-12"><Banknote className="h-3.5 w-3.5" /> Payments automatically settle the membership fee before capital share.</p>}
    </form>
  </div>;
}
