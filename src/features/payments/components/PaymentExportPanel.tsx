import { Building2, CheckCheck, FileSpreadsheet, FileText, Layers3, LoaderCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Employee } from "../../../types/employee";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import type { PaymentLedger } from "../../../types/payment";
import { employmentStatuses } from "../../employees/data/employeeOptions";
import { buildPaymentExportData, PAYMENT_EXPORT_SHEETS, type PaymentExportScope, type PaymentExportSheetName } from "../../../services/payments/paymentExport";
import { downloadPaymentCsv, downloadPaymentExcel } from "../../../services/payments/downloadPaymentExport";
import { EmployeeSearchField } from "./EmployeeSearchField";

type Props = {
  employees: Employee[];
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  onLoadLedger: () => Promise<PaymentLedger>;
};

const sheetLabels: Record<PaymentExportSheetName, string> = {
  PAYMENT_YEARLY: "Yearly totals",
  PAYMENT_MONTHLY: "Monthly totals",
  PAYMENT_PERIOD: "Actual payroll cut-off totals",
};

export function PaymentExportPanel({ employees, branches, clients, onLoadLedger }: Props) {
  const [scope, setScope] = useState<PaymentExportScope>("all");
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [employmentStatusId, setEmploymentStatusId] = useState("");
  const [sheets, setSheets] = useState<PaymentExportSheetName[]>(["PAYMENT_YEARLY", "PAYMENT_MONTHLY"]);
  const [busy, setBusy] = useState<"excel" | "csv" | null>(null);
  const [message, setMessage] = useState("");
  const availableClients = useMemo(() => clients.filter((client) => !branchId || client.branchId === branchId), [branchId, clients]);

  function changeScope(next: PaymentExportScope) {
    setScope(next);
    setMessage("");
    if (next !== "branch") setBranchId("");
    if (next !== "employee") setEmployeeId("");
    setClientIds([]);
  }

  function toggleSheet(sheet: PaymentExportSheetName) {
    setSheets((current) => current.includes(sheet) ? current.filter((item) => item !== sheet) : [...current, sheet]);
  }

  function toggleClient(clientId: string) {
    setClientIds((current) => current.includes(clientId) ? current.filter((item) => item !== clientId) : [...current, clientId]);
  }

  async function exportFile(format: "excel" | "csv") {
    setMessage("");
    if (!sheets.length) return setMessage("Select at least one sheet to export.");
    if (scope === "branch" && !branchId) return setMessage("Select a branch for the per-branch export.");
    if (scope === "employee" && !employeeId) return setMessage("Search and select an employee for the per-employee export.");
    setBusy(format);
    try {
      const ledger = await onLoadLedger();
      const data = buildPaymentExportData(employees, ledger, {
        scope, branchId, clientIds, employeeId, employmentStatusId,
        allowedBranchIds: branches.map((branch) => branch.id),
      }, sheets);
      const today = new Date().toISOString().slice(0, 10);
      const scopeName = scope === "branch" ? branches.find((branch) => branch.id === branchId)?.code ?? "BRANCH" : scope === "employee" ? employees.find((employee) => employee.id === employeeId)?.employee_number ?? "EMPLOYEE" : "ALL";
      const baseName = `PAYMENTS_${scopeName}_${data.firstYear}-${data.lastYear}_${today}`.replaceAll(/[^A-Z0-9_-]/gi, "_");
      if (format === "excel") await downloadPaymentExcel(data, baseName);
      else downloadPaymentCsv(data, baseName);
      setMessage(`Exported ${data.paymentCount} payments for ${data.employeeCount} employee${data.employeeCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The payment export could not be generated.");
    } finally {
      setBusy(null);
    }
  }

  return <div>
    <div className="border-b border-line bg-[#f8faf8] px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#e4efe9] text-moss"><FileSpreadsheet className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Export payment history</h3><p className="mt-0.5 text-xs text-ink/50">Generate the approved yearly, monthly, and payroll cut-off layouts.</p></div></div>
    </div>
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
      <div className="space-y-5">
        <fieldset><legend className="field-label mb-2">Include</legend><div className="inline-flex w-full rounded-md border border-line bg-paper p-1 sm:w-auto">{([{ value: 'all', label: 'All records', icon: Layers3 }, { value: 'branch', label: 'Per branch', icon: Building2 }, { value: 'employee', label: 'Per employee', icon: UserRound }] as const).map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => changeScope(value)} className={`focus-ring inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition sm:flex-none ${scope === value ? "bg-white text-moss shadow-sm" : "text-ink/55 hover:text-ink"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {scope === "branch" ? <label className="field-label">Branch<select className="control mt-1 w-full" value={branchId} onChange={(event) => { setBranchId(event.target.value); setClientIds([]); }}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label> : null}
          {scope === "employee" ? <EmployeeSearchField employees={employees} value={employeeId} onChange={setEmployeeId} label="Employee" required /> : null}
          <label className="field-label">Employee status<select className="control mt-1 w-full" value={employmentStatusId} onChange={(event) => setEmploymentStatusId(event.target.value)}><option value="">All statuses</option>{employmentStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
        </div>
        <fieldset><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><legend className="field-label">Clients <span className="font-normal text-ink/40">(multiple allowed)</span></legend><div className="flex gap-1"><button type="button" className="icon-button h-7 w-7" title="Select all clients" aria-label="Select all clients" onClick={() => setClientIds(availableClients.map((client) => client.id))}><CheckCheck className="h-3.5 w-3.5" /></button><button type="button" className="icon-button h-7 w-7" title="Clear selected clients" aria-label="Clear selected clients" onClick={() => setClientIds([])}><X className="h-3.5 w-3.5" /></button></div></div><div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-line bg-white p-2 sm:grid-cols-2">{availableClients.map((client) => <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs text-ink/70 hover:bg-paper"><input type="checkbox" checked={clientIds.includes(client.id)} onChange={() => toggleClient(client.id)} /><span className="truncate">{client.label}</span></label>)}{!availableClients.length ? <p className="px-2 py-4 text-center text-xs text-ink/45 sm:col-span-2">No clients are available in this scope.</p> : null}</div><p className="mt-1.5 text-[11px] text-ink/40">No selection includes all accessible clients, including direct Head Office payments.</p></fieldset>
      </div>
      <div className="space-y-4 lg:border-l lg:border-line lg:pl-5">
        <fieldset><legend className="field-label mb-2">Sheets to include</legend><div className="space-y-1 rounded-md border border-line bg-white p-2">{PAYMENT_EXPORT_SHEETS.map((sheet) => <label key={sheet} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-paper"><input type="checkbox" checked={sheets.includes(sheet)} onChange={() => toggleSheet(sheet)} /><span><span className="block text-xs font-semibold text-ink">{sheet}</span><span className="block text-[11px] text-ink/45">{sheetLabels[sheet]}{sheet === "PAYMENT_PERIOD" ? " / optional" : ""}</span></span></label>)}</div></fieldset>
        <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-[11px] leading-5 text-emerald-800"><span className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-3.5 w-3.5" />RBAC scope enforced</span><span className="mt-0.5 block text-emerald-700">Only payments from your accessible branches and clients can be exported.</span></div>
        {message ? <p role="status" className={`rounded-md px-3 py-2 text-xs ${message.startsWith("Exported") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{message}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><button type="button" className="primary-button w-full" disabled={Boolean(busy)} onClick={() => void exportFile("excel")}>{busy === "excel" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}Export Excel</button><button type="button" className="secondary-button w-full" disabled={Boolean(busy)} onClick={() => void exportFile("csv")}>{busy === "csv" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Export CSV</button></div>
        <p className="text-[11px] leading-5 text-ink/40">Matching cut-off ranges share one header such as Jan_1-15 across clients and years. When several sheets are selected, CSV files are packaged together in one ZIP download.</p>
      </div>
    </div>
  </div>;
}
