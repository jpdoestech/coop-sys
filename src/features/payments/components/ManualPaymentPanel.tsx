import { useMemo, useState } from "react";
import { Banknote, Save } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import { employeeFullName } from "../../../services/imports/identityMatching";
import { pesosToCentavos } from "../../../services/payments/paymentMath";
import type { PaymentBatchInput, PaymentLineInput } from "../../../services/repositories/PaymentRepository";

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

  return <form onSubmit={submit} className="grid gap-3 p-4 lg:grid-cols-6">
    <label className="field-label lg:col-span-2">Branch<select className="control mt-1" required value={branchId} onChange={(e) => { setBranchId(e.target.value); setClientId(""); setEmployeeId(""); }}><option value="">Select branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className="field-label lg:col-span-2">Client<select className="control mt-1" value={clientId} onChange={(e) => { setClientId(e.target.value); setEmployeeId(""); }}><option value="">Direct / all clients</option>{clients.filter((item) => item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className="field-label lg:col-span-2">Payment date<input className="control mt-1" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
    <label className="field-label lg:col-span-3">Member / employee<select className="control mt-1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Select employee</option>{scoped.map((item) => <option key={item.id} value={item.id}>{item.employee_number} - {employeeFullName(item)}</option>)}</select></label>
    <label className="field-label">Amount<input className="control mt-1" inputMode="decimal" placeholder="0.00" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
    <label className="field-label lg:col-span-2">Remarks<input className="control mt-1" maxLength={200} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
    {error ? <p className="text-xs text-red-700 lg:col-span-4">{error}</p> : <p className="flex items-center gap-2 text-xs text-ink/50 lg:col-span-4"><Banknote className="h-4 w-4" /> Payment applies to membership fee first, then capital share.</p>}
    <button disabled={saving} className="primary-button justify-self-end lg:col-span-2"><Save className="h-4 w-4" /> {saving ? "Posting..." : "Post payment"}</button>
  </form>;
}
