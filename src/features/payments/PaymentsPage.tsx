import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Banknote, FileUp, History, RotateCcw, Search, Settings2, WalletCards } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAccess } from "../../services/access/useAccess";
import { branchIsInScope } from "../../services/access/accessControl";
import { useOrganization } from "../../services/organization/useOrganization";
import { effectiveSettings, formatPesos } from "../../services/payments/paymentMath";
import { usePayments } from "./hooks/usePayments";
import { ManualPaymentPanel } from "./components/ManualPaymentPanel";
import { PaymentImportPanel } from "./components/PaymentImportPanel";
import { FinalPayPanel } from "./components/FinalPayPanel";
import { PaymentSettingsPanel } from "./components/PaymentSettingsPanel";
import { PaginationControls } from "../../components/ui/PaginationControls";

type Tab = "ledger" | "manual" | "import" | "final" | "settings";

export function PaymentsPage() {
  const { profile, can } = useAccess(); const { branches, clients } = useOrganization();
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [employeeSearch, setEmployeeSearch] = useState(""); const deferredEmployeeSearch = useDeferredValue(employeeSearch); const payments = usePayments(page, pageSize, deferredEmployeeSearch);
  const [tab, setTab] = useState<Tab>("ledger");
  const ledger = payments.ledger.data ?? { settings: [], aliases: [], batches: [], payments: [], settlements: [], paymentTotal: 0 };
  const employees = payments.employees.data ?? [];
  const allowedBranches = branches.filter((branch) => branchIsInScope(branch.id, profile));
  const allowedBranchIds = new Set(allowedBranches.map((item) => item.id));
  const allowedClients = clients.filter((client) => allowedBranchIds.has(client.branchId));
  const currentSettings = effectiveSettings(ledger.settings, new Date().toISOString().slice(0, 10));
  const totals = useMemo(() => ledger.payments.reduce((sum, item) => ({ amount: sum.amount + item.amount_centavos, fee: sum.fee + item.membership_fee_centavos, capital: sum.capital + item.capital_share_centavos }), { amount: 0, fee: 0, capital: 0 }), [ledger.payments]);
  const tabs: Array<{ id: Tab; label: string; icon: typeof History; visible: boolean }> = [
    { id: "ledger", label: "Transactions", icon: History, visible: true }, { id: "manual", label: "Manual payment", icon: Banknote, visible: can("payments.manage") },
    { id: "import", label: "Payroll import", icon: FileUp, visible: can("payments.manage") }, { id: "final", label: "Final pay", icon: RotateCcw, visible: can("payments.manage") },
    { id: "settings", label: "Settings", icon: Settings2, visible: can("payments.settings.manage") },
  ];
  const post = (batch: Parameters<typeof payments.postBatch.mutate>[0]["batch"], lines: Parameters<typeof payments.postBatch.mutate>[0]["lines"]) => payments.postBatch.mutate({ batch, lines }, { onSuccess: () => setTab("ledger") });
  useEffect(() => setPage(1), [deferredEmployeeSearch]);

  return <>
    <div className="flex items-start justify-between gap-4"><PageHeader eyebrow="Member finance" title="Payments" description="Membership fee, capital share, payroll deductions, and final-pay refunds." /><div className="hidden items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs sm:flex"><WalletCards className="h-4 w-4 text-moss" /><span>{currentSettings ? `${formatPesos(currentSettings.membership_fee_centavos + currentSettings.capital_share_target_centavos)} default obligation` : "No active settings"}</span></div></div>
    <div className="mb-3 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-md border border-line bg-white"><div className="px-4 py-3"><p className="text-[10px] font-bold uppercase text-ink/40">Page collected</p><p className="mt-1 text-lg font-bold">{formatPesos(totals.amount)}</p></div><div className="px-4 py-3"><p className="text-[10px] font-bold uppercase text-ink/40">Page membership fees</p><p className="mt-1 text-lg font-bold">{formatPesos(totals.fee)}</p></div><div className="px-4 py-3"><p className="text-[10px] font-bold uppercase text-ink/40">Page capital share</p><p className="mt-1 text-lg font-bold text-moss">{formatPesos(totals.capital)}</p></div></div>
    <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
      <div className="flex gap-1 overflow-x-auto border-b border-line p-2">{tabs.filter((item) => item.visible).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "primary-button" : "secondary-button"}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
      {payments.ledger.isError || payments.employees.isError ? <p className="p-5 text-sm text-red-700">Payment records could not be loaded.</p> : null}
      {payments.postBatch.error || payments.saveSettings.error || payments.settle.error ? <p className="border-b border-line bg-red-50 px-4 py-2 text-xs text-red-700">{payments.postBatch.error?.message ?? payments.saveSettings.error?.message ?? payments.settle.error?.message}</p> : null}
      {tab === "ledger" ? <><div className="border-b border-line p-2"><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="compact-control w-full pl-9" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employee ID or name" aria-label="Search payment transactions by employee" /></div></div><div className="max-h-[520px] overflow-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="sticky top-0 bg-ink text-white"><tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Employee</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5">Membership fee</th><th className="px-4 py-2.5">Capital share</th><th className="px-4 py-2.5">Total</th></tr></thead><tbody>{ledger.payments.map((item) => { const employee = employees.find((record) => record.id === item.employee_id); return <tr key={item.id} className="border-b border-line"><td className="px-4 py-3">{item.payment_date}</td><td className="px-4 py-3"><span className="block font-semibold">{employee ? `${employee.last_name}, ${employee.first_name}` : "Unavailable employee"}</span><span className="text-ink/45">{employee?.employee_number}</span></td><td className="px-4 py-3 capitalize">{item.method.replace("_", " ")}</td><td className="px-4 py-3">{formatPesos(item.membership_fee_centavos)}</td><td className="px-4 py-3">{formatPesos(item.capital_share_centavos)}</td><td className="px-4 py-3 font-semibold">{formatPesos(item.amount_centavos)}</td></tr>; })}{!ledger.payments.length ? <tr><td className="px-4 py-12 text-center text-ink/45" colSpan={6}>{employeeSearch ? "No payments found for this employee within your access scope." : "No payments posted yet."}</td></tr> : null}</tbody></table></div><PaginationControls page={page} pageSize={pageSize} total={ledger.paymentTotal} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : null}
      {tab === "manual" ? <ManualPaymentPanel employees={employees} branches={allowedBranches} clients={allowedClients} userId={profile.userId} saving={payments.postBatch.isPending} onPost={post} /> : null}
      {tab === "import" ? <PaymentImportPanel employees={employees} aliases={ledger.aliases} branches={allowedBranches} clients={allowedClients} userId={profile.userId} saving={payments.postBatch.isPending} onSaveAlias={payments.saveAlias.mutateAsync} onPost={post} /> : null}
      {tab === "final" ? <FinalPayPanel employees={employees} payments={ledger.payments} settlements={ledger.settlements} userId={profile.userId} saving={payments.settle.isPending} onSettle={(input) => payments.settle.mutate(input, { onSuccess: () => setTab("ledger") })} /> : null}
      {tab === "settings" ? <PaymentSettingsPanel settings={ledger.settings} saving={payments.saveSettings.isPending} onSave={(input) => payments.saveSettings.mutate(input)} /> : null}
    </section>
  </>;
}
