import {
  AlertTriangle,
  CalendarDays,
  FileSpreadsheet,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Employee } from "../../../types/employee";
import type {
  OrganizationBranch,
  OrganizationClient,
} from "../../../types/organization";
import type {
  OverDeductionRefund,
  PaymentImportMatch,
} from "../../../types/payment";
import type {
  RefundInput,
  RefundPage,
  RefundQueryOptions,
} from "../../../services/repositories/PaymentRepository";
import {
  employeeFullName,
  matchPaymentRows,
} from "../../../services/imports/identityMatching";
import {
  paymentRowsFromSpreadsheet,
  readSpreadsheet,
} from "../../../services/imports/excelWorkbook";
import {
  formatPesos,
  pesosToCentavos,
} from "../../../services/payments/paymentMath";
import { EmployeeSearchField } from "./EmployeeSearchField";
import { PaginationControls } from "../../../components/ui/PaginationControls";

type View = "records" | "manual" | "import";
type Props = {
  employees: Employee[];
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  userId: string;
  saving: boolean;
  onLoadRefunds: (options: RefundQueryOptions) => Promise<RefundPage>;
  onSave: (input: RefundInput) => Promise<OverDeductionRefund>;
};
const today = () => new Date().toISOString().slice(0, 10);

export function RefundPanel({
  employees,
  branches,
  clients,
  userId,
  saving,
  onLoadRefunds,
  onSave,
}: Props) {
  const [view, setView] = useState<View>("records");
  const [editing, setEditing] = useState<OverDeductionRefund | null>(null);
  const [branchId, setBranchId] = useState("");
  const [clientId, setClientId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [refundDate, setRefundDate] = useState(today());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState<PaymentImportMatch[]>([]);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [refundPage, setRefundPage] = useState<RefundPage>({
    items: [],
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void onLoadRefunds({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((value) => {
        if (active) setRefundPage(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Refund records could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [onLoadRefunds, page, pageSize, refreshVersion]);
  const scoped = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.member_id &&
          employee.active_assignment?.branch_id === branchId &&
          (!clientId || employee.active_assignment?.client_id === clientId),
      ),
    [employees, branchId, clientId],
  );
  const visibleRefunds = refundPage.items;
  const optionValue = (employee: Employee) =>
    `${employee.employee_number} - ${employeeFullName(employee)}`;

  function clearForm() {
    setEditing(null);
    setEmployeeId("");
    setAmount("");
    setRefundDate(today());
    setFrom("");
    setTo("");
    setRemarks("");
    setError("");
  }
  function openEdit(refund: OverDeductionRefund) {
    setEditing(refund);
    setBranchId(refund.branch_id);
    setClientId(refund.client_id ?? "");
    setEmployeeId(refund.employee_id);
    setAmount((refund.amount_centavos / 100).toFixed(2));
    setRefundDate(refund.refund_date);
    setFrom(refund.cutoff_from ?? "");
    setTo(refund.cutoff_to ?? "");
    setRemarks(refund.remarks ?? "");
    setError("");
    setView("manual");
  }
  async function saveManual(event: React.FormEvent) {
    event.preventDefault();
    try {
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee?.member_id || !branchId)
        throw new Error("Select a linked member/employee and placement.");
      if ((from || to) && (!from || !to || from > to))
        throw new Error("Enter both valid cut-off dates, or leave both blank.");
      await onSave({
        id: editing?.id,
        employee_id: employee.id,
        member_id: employee.member_id,
        branch_id: branchId,
        client_id: clientId || null,
        amount_centavos: pesosToCentavos(amount),
        refund_date: refundDate,
        cutoff_from: from || null,
        cutoff_to: to || null,
        method: editing?.method ?? "manual",
        source_file_name: editing?.source_file_name ?? null,
        remarks: remarks.trim() || null,
        created_by: editing?.created_by ?? userId,
      });
      setRefreshVersion((value) => value + 1);
      clearForm();
      setView("records");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Refund could not be saved.",
      );
    }
  }
  async function load(file?: File) {
    if (!file) return;
    try {
      if (!branchId)
        throw new Error("Select a branch before choosing the refund workbook.");
      const rows = paymentRowsFromSpreadsheet(await readSpreadsheet(file));
      setMatches(matchPaymentRows(rows, scoped, [], clientId));
      setOverrides({});
      setFileName(file.name);
      setError("");
    } catch (reason) {
      setMatches([]);
      setError(
        reason instanceof Error
          ? reason.message
          : "Refund workbook could not be read.",
      );
    }
  }
  async function importRows() {
    try {
      if (!matches.length) throw new Error("Choose a refund workbook first.");
      if ((from || to) && (!from || !to || from > to))
        throw new Error("Enter both valid cut-off dates, or leave both blank.");
      for (const row of matches) {
        const id = row.employeeId ?? overrides[row.rowNumber];
        const employee = scoped.find((item) => item.id === id);
        if (!employee?.member_id)
          throw new Error(
            `Row ${row.rowNumber}: link a member/employee before importing.`,
          );
        await onSave({
          employee_id: employee.id,
          member_id: employee.member_id,
          branch_id: branchId,
          client_id: clientId || null,
          amount_centavos: row.amountCentavos,
          refund_date: refundDate,
          cutoff_from: from || null,
          cutoff_to: to || null,
          method: "import",
          source_file_name: fileName,
          remarks: row.remarks || null,
          created_by: userId,
        });
      }
      setMatches([]);
      setFileName("");
      setError("");
      setRefreshVersion((value) => value + 1);
      setView("records");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Refunds could not be imported.",
      );
    }
  }

  const tabs: Array<{ id: View; label: string; icon: typeof List }> = [
    { id: "records", label: "Refund records", icon: List },
    { id: "manual", label: "Manual refund", icon: Plus },
    { id: "import", label: "Import refunds", icon: Upload },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-[#fbfcfb] p-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold ${view === item.id ? "bg-[#e4efe9] text-moss" : "text-ink/55 hover:bg-paper"}`}
            onClick={() => {
              setView(item.id);
              setError("");
              if (item.id === "manual" && view !== "manual") clearForm();
            }}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="flex items-center gap-2 border-b border-line bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </p>
      ) : null}
      {view === "records" ? (
        <>
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="sticky top-0 bg-[#f6f8f6] text-[10px] uppercase text-ink/45">
                <tr>
                  <th className="px-4 py-2">Refund date</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Branch / Client</th>
                  <th className="px-3 py-2">Cut-off refunded</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRefunds.map((refund) => {
                  const employee = employees.find(
                    (item) => item.id === refund.employee_id,
                  );
                  const branch = branches.find(
                    (item) => item.id === refund.branch_id,
                  );
                  const client = clients.find(
                    (item) => item.id === refund.client_id,
                  );
                  return (
                    <tr key={refund.id} className="hover:bg-[#f8faf8]">
                      <td className="px-4 py-2.5 font-mono">
                        {refund.refund_date}
                      </td>
                      <td className="px-3 py-2.5">
                        <strong className="block">
                          {employee
                            ? employeeFullName(employee)
                            : "Unavailable employee"}
                        </strong>
                        <span className="font-mono text-[10px] text-ink/45">
                          {employee?.employee_number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block font-medium">
                          {client?.label ?? branch?.label}
                        </span>
                        <span className="text-[10px] text-ink/45">
                          {client ? branch?.label : "Direct employee"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {refund.cutoff_from && refund.cutoff_to
                          ? `${refund.cutoff_from} to ${refund.cutoff_to}`
                          : "Date only"}
                      </td>
                      <td className="px-3 py-2.5 capitalize">
                        {refund.method}
                      </td>
                      <td
                        className="max-w-56 truncate px-3 py-2.5 text-ink/60"
                        title={refund.remarks ?? ""}
                      >
                        {refund.remarks || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">
                        {formatPesos(refund.amount_centavos)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="icon-button"
                          title="Edit refund"
                          aria-label="Edit refund"
                          onClick={() => openEdit(refund)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visibleRefunds.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-ink/45"
                    >
                      No over-deduction refunds recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={refundPage.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      ) : null}
      {view === "manual" ? (
        <form
          onSubmit={(event) => void saveManual(event)}
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12"
        >
          <label className="field-label lg:col-span-3">
            Branch
            <select
              className="control mt-1 w-full"
              required
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setClientId("");
                setEmployeeId("");
              }}
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label lg:col-span-3">
            Client
            <select
              className="control mt-1 w-full"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setEmployeeId("");
              }}
            >
              <option value="">Direct / all clients</option>
              {clients
                .filter((client) => client.branchId === branchId)
                .map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
            </select>
          </label>
          <div className="lg:col-span-4">
            <EmployeeSearchField
              employees={scoped}
              value={employeeId}
              onChange={setEmployeeId}
              label="Member / employee"
              required
            />
          </div>
          <label className="field-label lg:col-span-2">
            Refund date
            <div className="relative mt-1">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
              <input
                className="control w-full pl-9"
                type="date"
                required
                value={refundDate}
                onChange={(event) => setRefundDate(event.target.value)}
              />
            </div>
          </label>
          <label className="field-label lg:col-span-3">
            Amount (PHP)
            <input
              className="control mt-1 w-full font-mono"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="field-label lg:col-span-2">
            Cut-off from
            <input
              className="control mt-1 w-full"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field-label lg:col-span-2">
            Cut-off to
            <input
              className="control mt-1 w-full"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="field-label lg:col-span-3">
            Remarks
            <input
              className="control mt-1 w-full"
              maxLength={200}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </label>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button className="primary-button flex-1" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : editing ? "Update" : "Save refund"}
            </button>
            {editing ? (
              <button
                type="button"
                className="icon-button h-10 w-10"
                title="Cancel edit"
                onClick={() => {
                  clearForm();
                  setView("records");
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {view === "import" ? (
        <div className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="field-label">
              Branch
              <select
                className="control mt-1 w-full"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setClientId("");
                  setMatches([]);
                }}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Client
              <select
                className="control mt-1 w-full"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setMatches([]);
                }}
              >
                <option value="">Direct / all clients</option>
                {clients
                  .filter((client) => client.branchId === branchId)
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field-label">
              Refund date
              <input
                className="control mt-1 w-full"
                type="date"
                value={refundDate}
                onChange={(event) => setRefundDate(event.target.value)}
              />
            </label>
            <label className="field-label">
              Cut-off from
              <input
                className="control mt-1 w-full"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field-label">
              Cut-off to
              <input
                className="control mt-1 w-full"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-line bg-paper px-4 py-3 text-sm hover:border-moss">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-moss" />
              <span>
                <span className="block font-medium">
                  {fileName || "Choose refund workbook"}
                </span>
                <span className="text-xs text-ink/45">
                  Headers: ID, NAME, AMOUNT, REMARKS. ID may be blank.
                </span>
              </span>
            </span>
            <Upload className="h-4 w-4" />
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={(event) => void load(event.target.files?.[0])}
            />
          </label>
          {matches.length ? (
            <>
              <datalist id="refund-import-employees">
                {scoped.map((employee) => (
                  <option key={employee.id} value={optionValue(employee)} />
                ))}
              </datalist>
              <div className="max-h-[44vh] overflow-auto rounded-md border border-line">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="sticky top-0 bg-[#f6f8f6] text-[10px] uppercase text-ink/45">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Imported employee</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Employee link</th>
                      <th className="px-3 py-2">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {matches.map((row) => {
                      const id = row.employeeId ?? overrides[row.rowNumber];
                      const employee = scoped.find((item) => item.id === id);
                      return (
                        <tr key={row.rowNumber}>
                          <td className="px-3 py-2 font-mono">
                            {row.rowNumber}
                          </td>
                          <td className="px-3 py-2">
                            <strong className="block">{row.name}</strong>
                            <span className="text-[10px] text-ink/45">
                              {row.id || "No ID"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatPesos(row.amountCentavos)}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="compact-control w-full"
                              list="refund-import-employees"
                              defaultValue={
                                employee ? optionValue(employee) : ""
                              }
                              placeholder="Type employee ID or name"
                              onChange={(event) => {
                                const found = scoped.find(
                                  (item) =>
                                    optionValue(item) === event.target.value ||
                                    item.employee_number === event.target.value,
                                );
                                setOverrides((current) => ({
                                  ...current,
                                  [row.rowNumber]: found?.id ?? "",
                                }));
                              }}
                            />
                          </td>
                          <td
                            className={`px-3 py-2 ${employee?.member_id ? "text-emerald-700" : "text-amber-700"}`}
                          >
                            {employee?.member_id
                              ? "Ready"
                              : "Employee not found or not linked"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    saving ||
                    matches.some(
                      (row) =>
                        !scoped.find(
                          (employee) =>
                            employee.id ===
                            (row.employeeId ?? overrides[row.rowNumber]),
                        )?.member_id,
                    )
                  }
                  onClick={() => void importRows()}
                >
                  <Upload className="h-4 w-4" />
                  {saving ? "Importing..." : `Import ${matches.length} refunds`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
