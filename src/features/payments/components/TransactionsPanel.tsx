import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  Pencil,
  RotateCcw,
  Search,
} from "lucide-react";
import type { Employee } from "../../../types/employee";
import type {
  OrganizationBranch,
  OrganizationClient,
} from "../../../types/organization";
import type { MemberPayment, PaymentLedger } from "../../../types/payment";
import type { PaymentSortKey } from "../../../services/repositories/PaymentRepository";
import { formatPesos } from "../../../services/payments/paymentMath";
import { compactPeriod } from "../paymentFilters";
import { PaginationControls } from "../../../components/ui/PaginationControls";
import {
  PlacementSearchField,
  type PlacementFilter,
} from "./PlacementSearchField";

export type TransactionFilters = {
  employeeSearch: string;
  year: string;
  placement: PlacementFilter;
  sortBy: PaymentSortKey;
  sortDirection: "asc" | "desc";
};
type Props = {
  ledger: PaymentLedger;
  employees: Employee[];
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  filters: TransactionFilters;
  yearError: boolean;
  page: number;
  pageSize: number;
  canEdit: boolean;
  onFiltersChange: (filters: TransactionFilters) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (payment: MemberPayment) => void;
};

const columns: Array<{
  key: PaymentSortKey;
  label: string;
  align?: "right";
  size: string;
}> = [
    { key: "date", label: "Date", size: "w-[92px]" },
    { key: "employee", label: "Employee", size: "w-[150px]" },
    { key: "placement", label: "Branch / Client", size: "w-[180px]" },
    { key: "year", label: "Year", size: "w-[52px]" },
    { key: "period", label: "Month / Period", size: "w-[100px]" },
    { key: "method", label: "Method", size: "w-[96px]" },
    { key: "fee", label: "Membership fee", align: "right", size: "w-[104px]" },
    { key: "capital", label: "Capital share", align: "right", size: "w-[100px]" },
    { key: "total", label: "Total", align: "right", size: "w-[92px]" },
  ];

export function TransactionsPanel({
  ledger,
  employees,
  branches,
  clients,
  filters,
  yearError,
  page,
  pageSize,
  canEdit,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onEdit,
}: Props) {
  const batchById = new Map(ledger.batches.map((batch) => [batch.id, batch]));
  const totals = ledger.payments.reduce(
    (sum, item) => ({
      amount: sum.amount + item.amount_centavos,
      fee: sum.fee + item.membership_fee_centavos,
      capital: sum.capital + item.capital_share_centavos,
    }),
    { amount: 0, fee: 0, capital: 0 },
  );
  const correctedIds = new Set(
    ledger.corrections.map((correction) => correction.payment_id),
  );
  function sort(key: PaymentSortKey) {
    onFiltersChange({
      ...filters,
      sortBy: key,
      sortDirection:
        filters.sortBy === key && filters.sortDirection === "asc"
          ? "desc"
          : "asc",
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input
            className="compact-control w-full pl-8"
            value={filters.employeeSearch}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                employeeSearch: event.target.value,
              })
            }
            placeholder="Search employee"
            aria-label="Search payment transactions by employee"
          />
        </div>
        <div className="relative w-full sm:w-36">
          <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input
            className={`compact-control w-full pl-8 ${yearError ? "border-red-400" : ""}`}
            value={filters.year}
            onChange={(event) =>
              onFiltersChange({ ...filters, year: event.target.value })
            }
            placeholder="2021-2025"
            aria-label="Filter transaction year or year range"
          />
        </div>
        <PlacementSearchField
          branches={branches}
          clients={clients}
          value={filters.placement}
          onChange={(placement) => onFiltersChange({ ...filters, placement })}
        />
        <button
          type="button"
          className="secondary-button ml-auto"
          onClick={() =>
            onFiltersChange({
              employeeSearch: "",
              year: String(new Date().getFullYear()),
              placement: null,
              sortBy: "date",
              sortDirection: "desc",
            })
          }
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
      {yearError ? (
        <p className="border-b border-line bg-red-50 px-3 py-2 text-xs text-red-700">
          Use a four-digit year or range, such as 2026 or 2021-2025.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#fbfcfb] px-3 py-2 text-[11px] text-ink/50">
        <span>
          <strong className="text-ink">{ledger.paymentTotal}</strong> records
        </span>
        <div className="flex flex-wrap gap-x-4">
          <span>
            Page total{" "}
            <strong className="font-mono text-ink">
              {formatPesos(totals.amount)}
            </strong>
          </span>
          <span>
            Fees{" "}
            <strong className="font-mono text-ink">
              {formatPesos(totals.fee)}
            </strong>
          </span>
          <span>
            Capital{" "}
            <strong className="font-mono text-moss">
              {formatPesos(totals.capital)}
            </strong>
          </span>
        </div>
      </div>
      <div className="max-h-[64vh] overflow-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-xs">
          <thead className="sticky top-0 z-20 bg-[#f6f8f6] shadow-[0_1px_0_0_#d9ded9]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.size} px-2.5 py-2 ${column.align === "right" ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink/45 hover:text-moss ${column.align === "right" ? "ml-auto" : ""}`}
                    onClick={() => sort(column.key)}
                  >
                    {column.label}
                    {filters.sortBy === column.key ? (
                      filters.sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
              <th className="w-[50px] px-2.5 py-2 text-right text-[10px] font-semibold uppercase text-ink/45">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ledger.payments.map((item) => {
              const employee = employees.find(
                (record) => record.id === item.employee_id,
              );
              const batch = batchById.get(item.batch_id);
              const branch = branches.find(
                (record) => record.id === batch?.branch_id,
              );
              const client = clients.find(
                (record) => record.id === batch?.client_id,
              );
              const period = compactPeriod(
                batch?.cutoff_from ?? null,
                batch?.cutoff_to ?? null,
                item.payment_date,
              );
              return (
                <tr key={item.id} className="hover:bg-[#f8faf8]">
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[11px] text-ink/60">
                    {item.payment_date}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className="block truncate font-semibold" title={employee ? `${employee.last_name}, ${employee.first_name}` : "Unavailable employee"}>
                      {employee
                        ? `${employee.last_name}, ${employee.first_name}`
                        : "Unavailable employee"}
                    </span>
                    <span className="font-mono text-[10px] text-ink/45">
                      {employee?.employee_number}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className="block truncate font-medium" title={client?.label ?? branch?.label ?? "Unknown placement"}>
                      {client?.label ?? branch?.label ?? "Unknown placement"}
                    </span>
                    <span className="block truncate text-[10px] text-ink/45">
                      {client ? branch?.label : "Direct employee"}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 font-mono">
                    {item.payment_date.slice(0, 4)}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className="block font-medium">{period.month}</span>
                    <span className="font-mono text-[10px] text-ink/45">
                      {period.period}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className="rounded bg-paper px-2 py-1 text-[10px] font-medium capitalize">
                      {item.method.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatPesos(item.membership_fee_centavos)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatPesos(item.capital_share_centavos)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono font-semibold">
                      {formatPesos(item.amount_centavos)}
                    </span>
                    {correctedIds.has(item.id) ? (
                      <span className="mt-0.5 block text-[9px] font-semibold uppercase text-amber-700">
                        Corrected
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit transaction"
                        aria-label="Edit transaction"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-ink/25">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!ledger.payments.length ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-sm text-ink/45"
                >
                  No transactions match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={ledger.paymentTotal}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
