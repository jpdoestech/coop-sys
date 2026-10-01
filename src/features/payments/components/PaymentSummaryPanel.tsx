import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  Eye,
  Printer,
  RotateCcw,
  Search,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { PaginationControls } from "../../../components/ui/PaginationControls";
import { formatPesos } from "../../../services/payments/paymentMath";
import type {
  PaymentSummaryItem,
  PaymentSummaryPage,
  PaymentSummaryQueryOptions,
  PaymentSummarySortKey,
} from "../../../services/repositories/PaymentRepository";
import type {
  OrganizationBranch,
  OrganizationClient,
} from "../../../types/organization";
import type { PaymentLedger } from "../../../types/payment";
import { parseYearFilter } from "../paymentFilters";
import { openPrintReport, openPrintWindow } from "../printPaymentReport";
import { PaymentHistoryDialog } from "./PaymentHistoryDialog";
import {
  PlacementSearchField,
  type PlacementFilter,
} from "./PlacementSearchField";

type Props = {
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  onLoadSummary: (
    options: PaymentSummaryQueryOptions,
  ) => Promise<PaymentSummaryPage>;
  onLoadEmployeeLedger: (
    employeeId: string,
    options?: { limit?: number; offset?: number },
  ) => Promise<PaymentLedger>;
};

const emptyPage: PaymentSummaryPage = { items: [], total: 0 };

export function PaymentSummaryPanel({
  branches,
  clients,
  onLoadSummary,
  onLoadEmployeeLedger,
}: Props) {
  const [result, setResult] = useState<PaymentSummaryPage>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [placement, setPlacement] = useState<PlacementFilter>(null);
  const [sortBy, setSortBy] = useState<PaymentSummarySortKey>("employee");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyEmployee, setHistoryEmployee] =
    useState<PaymentSummaryItem | null>(null);
  const years = parseYearFilter(year);
  const yearFrom = years?.yearFrom;
  const yearTo = years?.yearTo;

  useEffect(() => {
    if (!yearFrom || !yearTo) {
      setLoading(false);
      setResult(emptyPage);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void onLoadSummary({
      search: deferredSearch,
      yearFrom,
      yearTo,
      branchIds: placement?.kind === "branch" ? [placement.id] : undefined,
      clientIds: placement?.kind === "client" ? [placement.id] : undefined,
      sortBy,
      sortDirection: direction,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((reason) => {
        if (active) {
          setResult(emptyPage);
          setError(
            reason instanceof Error
              ? reason.message
              : "Payment summary could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    direction,
    onLoadSummary,
    page,
    pageSize,
    placement,
    deferredSearch,
    sortBy,
    yearFrom,
    yearTo,
  ]);

  function sort(key: PaymentSummarySortKey) {
    setDirection(sortBy === key && direction === "asc" ? "desc" : "asc");
    setSortBy(key);
    setPage(1);
  }

  async function printSummary() {
    if (!yearFrom || !yearTo) return;
    let printWindow: Window | undefined;
    try {
      printWindow = openPrintWindow("Preparing Payment Summary");
      setPrinting(true);
      setError("");
      const report = await onLoadSummary({
        search: deferredSearch,
        yearFrom,
        yearTo,
        branchIds: placement?.kind === "branch" ? [placement.id] : undefined,
        clientIds: placement?.kind === "client" ? [placement.id] : undefined,
        sortBy,
        sortDirection: direction,
      });
      openPrintReport(
        {
          title: "Payment Summary",
          subtitle: "Membership fees and share capital by employee",
          meta: [
            `Year: ${year}`,
            `Scope: ${placement?.label ?? "All accessible branches and clients"}`,
            `Records: ${report.total}`,
          ],
          columns: [
            { label: "Date" },
            { label: "Employee" },
            { label: "Branch / Client" },
            { label: "First Payment" },
            { label: "Last Payment" },
            { label: "Membership Fee", align: "right" },
            { label: "Share Capital", align: "right" },
            { label: "Total Balance", align: "right" },
            { label: "Status" },
          ],
          rows: report.items.map((row) => [
            new Date().toISOString().slice(0, 10),
            `${row.employeeNumber} - ${row.lastName}, ${row.firstName}`,
            row.clientLabel
              ? `${row.clientLabel} / ${row.branchLabel ?? "Unknown branch"}`
              : `${row.branchLabel ?? "No placement"} / Direct employee`,
            row.firstPayment ?? "-",
            row.lastPayment ?? "-",
            formatPesos(row.membershipFeeCentavos),
            formatPesos(row.capitalShareCentavos),
            formatPesos(row.totalBalanceCentavos),
            row.status,
          ]),
        },
        printWindow,
      );
    } catch (reason) {
      printWindow?.close();
      setError(
        reason instanceof Error ? reason.message : "Print view could not open.",
      );
    } finally {
      setPrinting(false);
    }
  }

  const heading = (
    key: PaymentSummarySortKey,
    label: string,
    right = false,
  ) => (
    <button
      type="button"
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink/45 hover:text-moss ${right ? "ml-auto" : ""}`}
      onClick={() => sort(key)}
    >
      {label}
      {sortBy === key ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input
            className="compact-control w-full pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search employee"
          />
        </div>
        <div className="relative w-full sm:w-36">
          <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input
            className={`compact-control w-full pl-8 ${year.trim() && !years ? "border-red-400" : ""}`}
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              setPage(1);
            }}
            placeholder="2021-2025"
          />
        </div>
        <PlacementSearchField
          branches={branches}
          clients={clients}
          value={placement}
          onChange={(value) => {
            setPlacement(value);
            setPage(1);
          }}
        />
        <button
          type="button"
          className="secondary-button sm:ml-auto"
          onClick={() => void printSummary()}
          disabled={printing || !result.total || !years}
        >
          <Printer className="h-3.5 w-3.5" />
          {printing ? "Preparing..." : "Print"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setSearch("");
            setYear(String(new Date().getFullYear()));
            setPlacement(null);
            setSortBy("employee");
            setDirection("asc");
            setPage(1);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
      {error || (year.trim() && !years) ? (
        <p className="border-b border-line bg-red-50 px-3 py-2 text-xs text-red-700">
          {error ||
            "Use a four-digit year or range, such as 2026 or 2021-2025."}
        </p>
      ) : null}
      <div className="max-h-[64vh] overflow-auto">
        <table className="w-full min-w-[960px] table-fixed text-left text-xs">
          <thead className="sticky top-0 z-20 bg-[#f6f8f6] shadow-[0_1px_0_0_#d9ded9]">
            <tr>
              <th className="w-20 px-2 py-2">{heading("date", "Date")}</th>
              <th className="w-36 px-2 py-2">
                {heading("employee", "Employee")}
              </th>
              <th className="w-40 px-2 py-2">
                {heading("placement", "Branch / Client")}
              </th>
              <th className="w-24 px-2 py-2">
                {heading("first", "First payment")}
              </th>
              <th className="w-24 px-2 py-2">
                {heading("last", "Last payment")}
              </th>
              <th className="w-24 px-2 py-2 text-right">
                {heading("fee", "Membership fee", true)}
              </th>
              <th className="w-24 px-2 py-2 text-right">
                {heading("capital", "Share capital", true)}
              </th>
              <th className="w-24 px-2 py-2 text-right">
                {heading("balance", "Total balance", true)}
              </th>
              <th className="w-16 px-2 py-2">{heading("status", "Status")}</th>
              <th className="w-12 px-2 py-2 text-right text-[10px] font-semibold uppercase text-ink/45">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((row) => (
              <tr key={row.employeeId} className="hover:bg-[#f8faf8]">
                <td className="px-2 py-2.5 font-mono text-[10px]">
                  {new Date().toISOString().slice(0, 10)}
                </td>
                <td className="px-2 py-2.5">
                  <strong className="block truncate">
                    {row.lastName}, {row.firstName}
                  </strong>
                  <span className="font-mono text-[10px] text-ink/45">
                    {row.employeeNumber}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <strong className="block truncate">
                    {row.clientLabel ?? row.branchLabel ?? "No placement"}
                  </strong>
                  <span className="block truncate text-[10px] text-ink/45">
                    {row.clientLabel ? row.branchLabel : "Direct employee"}
                  </span>
                </td>
                <td className="px-2 py-2.5 font-mono text-[10px]">
                  {row.firstPayment ?? "-"}
                </td>
                <td className="px-2 py-2.5 font-mono text-[10px]">
                  {row.lastPayment ?? "-"}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {formatPesos(row.membershipFeeCentavos)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {formatPesos(row.capitalShareCentavos)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold">
                  {formatPesos(row.totalBalanceCentavos)}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${row.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    className="icon-button"
                    title="View payment history"
                    aria-label={`View payment history for ${row.firstName} ${row.lastName}`}
                    onClick={() => setHistoryEmployee(row)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !result.items.length ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-sm text-ink/45"
                >
                  No member/employee summaries match the filters.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-sm text-ink/45"
                >
                  Loading payment summary...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={result.total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      {historyEmployee ? (
        <PaymentHistoryDialog
          employee={historyEmployee}
          branches={branches}
          clients={clients}
          onLoadLedger={onLoadEmployeeLedger}
          onClose={() => setHistoryEmployee(null)}
        />
      ) : null}
    </>
  );
}
