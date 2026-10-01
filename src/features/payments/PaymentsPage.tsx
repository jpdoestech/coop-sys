import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Banknote, Download, FileUp, History, RotateCcw, Search, Settings2, WalletCards } from "lucide-react";
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
import { PaymentExportPanel } from "./components/PaymentExportPanel";

type Tab = "ledger" | "manual" | "import" | "final" | "export" | "settings";

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
    { id: "export", label: "Export", icon: Download, visible: can("payments.view") },
    { id: "settings", label: "Settings", icon: Settings2, visible: can("payments.settings.manage") },
  ];
  const post = (batch: Parameters<typeof payments.postBatch.mutate>[0]["batch"], lines: Parameters<typeof payments.postBatch.mutate>[0]["lines"]) => payments.postBatch.mutate({ batch, lines }, { onSuccess: () => setTab("ledger") });
  useEffect(() => setPage(1), [deferredEmployeeSearch]);

  return <>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PageHeader eyebrow="Member finance" title="Payments" description="Membership fee, capital share, payroll deductions, and final-pay refunds." /><div className="mb-3 inline-flex h-9 items-center gap-2 self-start rounded-md border border-line bg-white px-3 text-xs text-ink/65 shadow-sm"><WalletCards className="h-4 w-4 text-moss" /><span>{currentSettings ? `${formatPesos(currentSettings.membership_fee_centavos + currentSettings.capital_share_target_centavos)} default obligation` : "No active settings"}</span></div></div>
    <div className="overflow-x-auto"><div className="inline-flex min-w-max rounded-md border border-line bg-white p-1 shadow-sm">{tabs.filter((item) => item.visible).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`focus-ring inline-flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition ${tab === item.id ? "bg-[#e4efe9] text-moss" : "text-ink/55 hover:bg-paper hover:text-ink"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}</div></div>
    <section className="mt-4 overflow-hidden rounded-md border border-line bg-white shadow-panel">
      {payments.ledger.isError || payments.employees.isError ? <p className="p-5 text-sm text-red-700">Payment records could not be loaded.</p> : null}
      {payments.postBatch.error || payments.saveSettings.error || payments.settle.error ? <p className="border-b border-line bg-red-50 px-4 py-2 text-xs text-red-700">{payments.postBatch.error?.message ?? payments.saveSettings.error?.message ?? payments.settle.error?.message}</p> : null}
      {tab === "ledger" ? <><div className="flex flex-wrap items-center gap-2 p-2"><div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="compact-control w-full pl-9" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employee ID or name" aria-label="Search payment transactions by employee" /></div><div className="ml-auto hidden items-center divide-x divide-line text-[11px] text-ink/50 lg:flex"><span className="px-3">Page collected <strong className="ml-1 text-ink">{formatPesos(totals.amount)}</strong></span><span className="px-3">Page fees <strong className="ml-1 text-ink">{formatPesos(totals.fee)}</strong></span><span className="px-3">Page capital <strong className="ml-1 text-moss">{formatPesos(totals.capital)}</strong></span><span className="pl-3">{ledger.paymentTotal} records</span></div></div><div className="max-h-[62vh] overflow-auto border-t border-line"><table className="min-w-[850px] w-full text-left text-sm"><thead className="sticky top-0 z-10"><tr className="border-b border-line bg-[#f8faf8] text-[10px] uppercase text-ink/45"><th className="px-5 py-2.5">Date</th><th className="px-4 py-2.5">Employee</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5 text-right">Membership fee</th><th className="px-4 py-2.5 text-right">Capital share</th><th className="px-5 py-2.5 text-right">Total</th></tr></thead><tbody className="divide-y divide-line">{ledger.payments.map((item) => { const employee = employees.find((record) => record.id === item.employee_id); return <tr key={item.id} className="transition-colors hover:bg-[#f8faf8]"><td className="px-5 py-3 font-mono text-xs text-ink/60">{item.payment_date}</td><td className="px-4 py-3"><span className="block font-semibold">{employee ? `${employee.last_name}, ${employee.first_name}` : "Unavailable employee"}</span><span className="font-mono text-[11px] text-ink/45">{employee?.employee_number}</span></td><td className="px-4 py-3"><span className="rounded bg-paper px-2 py-1 text-xs capitalize text-ink/65">{item.method.replace("_", " ")}</span></td><td className="px-4 py-3 text-right font-mono text-xs">{formatPesos(item.membership_fee_centavos)}</td><td className="px-4 py-3 text-right font-mono text-xs">{formatPesos(item.capital_share_centavos)}</td><td className="px-5 py-3 text-right font-mono text-xs font-semibold">{formatPesos(item.amount_centavos)}</td></tr>; })}{!ledger.payments.length ? <tr><td className="px-4 py-12 text-center text-sm text-ink/45" colSpan={6}>{employeeSearch ? "No payments found for this employee within your access scope." : "No payments posted yet."}</td></tr> : null}</tbody></table></div><PaginationControls page={page} pageSize={pageSize} total={ledger.paymentTotal} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : null}
      {tab === "manual" ? <ManualPaymentPanel employees={employees} branches={allowedBranches} clients={allowedClients} userId={profile.userId} saving={payments.postBatch.isPending} onPost={post} /> : null}
      {tab === "import" ? <PaymentImportPanel employees={employees} aliases={ledger.aliases} branches={allowedBranches} clients={allowedClients} userId={profile.userId} saving={payments.postBatch.isPending} onSaveAlias={payments.saveAlias.mutateAsync} onPost={post} /> : null}
      {tab === "final" ? <FinalPayPanel employees={employees} payments={ledger.payments} settlements={ledger.settlements} userId={profile.userId} saving={payments.settle.isPending} onSettle={(input) => payments.settle.mutate(input, { onSuccess: () => setTab("ledger") })} /> : null}
      {tab === "export" ? <PaymentExportPanel employees={employees} branches={allowedBranches} clients={allowedClients} onLoadLedger={payments.loadExportLedger} /> : null}
      {tab === "settings" ? <PaymentSettingsPanel settings={ledger.settings} saving={payments.saveSettings.isPending} onSave={(input) => payments.saveSettings.mutate(input)} /> : null}
    </section>
  </>;
}
