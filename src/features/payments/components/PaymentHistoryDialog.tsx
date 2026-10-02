import { History, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PaginationControls } from "../../../components/ui/PaginationControls";
import type { PaymentSummaryItem } from "../../../services/repositories/PaymentRepository";
import type {
  OrganizationBranch,
  OrganizationClient,
} from "../../../types/organization";
import type { PaymentLedger } from "../../../types/payment";
import { formatPesos } from "../../../services/payments/paymentMath";
import { detailedPeriod } from "../paymentFilters";
import { openPrintReport, openPrintWindow } from "../printPaymentReport";
import { PrintOrientationToggle, type PrintOrientation } from "./PrintOrientationToggle";

type Props = {
  employee: PaymentSummaryItem;
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  onLoadLedger: (
    employeeId: string,
    options?: { limit?: number; offset?: number },
  ) => Promise<PaymentLedger>;
  onClose: () => void;
};

export function PaymentHistoryDialog({
  employee,
  branches,
  clients,
  onLoadLedger,
  onClose,
}: Props) {
  const [ledger, setLedger] = useState<PaymentLedger | null>(null);
  const [loadError, setLoadError] = useState("");
  const [printError, setPrintError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [orientation, setOrientation] = useState<PrintOrientation>("portrait");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    let active = true;
    setLedger(null);
    void onLoadLedger(employee.employeeId, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((value) => {
        if (active) setLedger(value);
      })
      .catch((reason) => {
        if (active)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Payment history could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [employee.employeeId, onLoadLedger, page, pageSize]);
  const payments = (ledger?.payments ?? [])
    .filter((payment) => payment.employee_id === employee.employeeId)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const refunds = (ledger?.refunds ?? [])
    .filter((refund) => refund.employee_id === employee.employeeId)
    .sort((a, b) => b.refund_date.localeCompare(a.refund_date));
  const batches = new Map(
    (ledger?.batches ?? []).map((batch) => [batch.id, batch]),
  );
  const employeeName = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(" ");
  async function printHistory() {
    let printWindow: Window | undefined;
    try {
      printWindow = openPrintWindow("Preparing Payment History");
      setPrinting(true);
      setPrintError("");
      const reportLedger = await onLoadLedger(employee.employeeId);
      const reportBatches = new Map(
        reportLedger.batches.map((batch) => [batch.id, batch]),
      );
      const events = [
        ...reportLedger.payments.map((payment) => {
        const batch = reportBatches.get(payment.batch_id);
        const branch = branches.find((item) => item.id === batch?.branch_id);
        const client = clients.find((item) => item.id === batch?.client_id);
        return {
          date: payment.payment_date,
          order: payment.created_at,
          placement: client ? `${client.label} / ${branch?.label ?? "Unknown branch"}` : `${branch?.label ?? "Unknown"} / Direct employee`,
          period: detailedPeriod(batch?.cutoff_from ?? null, batch?.cutoff_to ?? null, payment.payment_date),
          membershipFee: payment.membership_fee_centavos,
          capitalShare: payment.capital_share_centavos,
          amount: payment.amount_centavos,
          remarks: payment.method === "payroll_deduction" ? "Payroll Deduction" : "Payment",
        };
      }),
        ...reportLedger.refunds.map((refund) => ({
        date: refund.refund_date,
        order: refund.created_at,
        placement: "Over-deduction refund",
        period: detailedPeriod(refund.cutoff_from, refund.cutoff_to, refund.refund_date),
        membershipFee: 0,
        capitalShare: 0,
        amount: -refund.amount_centavos,
        remarks: refund.remarks ? `Refund · ${refund.remarks}` : "Refund",
      })),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
      let runningTotal = 0;
      const rows = events.map((event) => {
        runningTotal += event.amount;
        return [
          event.date,
          event.placement,
          event.period,
          event.membershipFee ? formatPesos(event.membershipFee) : "-",
          event.capitalShare ? formatPesos(event.capitalShare) : "-",
          event.amount < 0 ? `-${formatPesos(Math.abs(event.amount))}` : formatPesos(event.amount),
          formatPesos(runningTotal),
          event.remarks,
        ];
      });
      openPrintReport(
        {
          title: "Payment History",
          subtitle: `${employee.employeeNumber} - ${employeeName}`,
          meta: [
            `Payments: ${reportLedger.paymentTotal}`,
            `Refunds: ${reportLedger.refundTotal}`,
            `Generated: ${new Date().toISOString().slice(0, 10)}`,
          ],
          orientation,
          columns: [
            { label: "Date" },
            { label: "Branch / Client" },
            { label: "Period" },
            { label: "Membership Fee", align: "right" },
            { label: "Share Capital", align: "right" },
            { label: "Total", align: "right" },
            { label: "Total Paid", align: "right" },
            { label: "Remarks" },
          ],
          rows,
        },
        printWindow,
      );
    } catch (reason) {
      printWindow?.close();
      setPrintError(
        reason instanceof Error ? reason.message : "Print view could not open.",
      );
    } finally {
      setPrinting(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3">
      <section
        role="dialog"
        aria-modal="true"
        className="flex h-[min(760px,90vh)] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[#e4efe9] text-moss">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold">Payment history</h2>
              <p className="text-[11px] text-ink/45">
                {employee.employeeNumber} · {employeeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrintOrientationToggle value={orientation} onChange={setOrientation} />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void printHistory()}
              disabled={!ledger || printing}
            >
              <Printer className="h-3.5 w-3.5" />
              {printing ? "Preparing..." : "Print"}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close payment history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        {printError || loadError ? (
          <p className="border-b border-line bg-red-50 px-4 py-2 text-xs text-red-700">
            {printError || loadError}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] table-fixed text-left text-xs">
            <thead className="sticky top-0 bg-[#f6f8f6] text-[10px] uppercase text-ink/45">
              <tr>
                <th className="w-24 px-3 py-2">Date</th>
                <th className="w-48 px-3 py-2">Branch / Client</th>
                <th className="w-44 px-3 py-2">Period</th>
                <th className="w-28 px-3 py-2 text-right">Membership fee</th>
                <th className="w-28 px-3 py-2 text-right">Share capital</th>
                <th className="w-24 px-3 py-2 text-right">Total</th>
                <th className="w-28 px-3 py-2 text-right">Total paid</th>
                <th className="px-3 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((payment) => {
                const batch = batches.get(payment.batch_id);
                const branch = branches.find(
                  (item) => item.id === batch?.branch_id,
                );
                const client = clients.find(
                  (item) => item.id === batch?.client_id,
                );
                const period = detailedPeriod(
                  batch?.cutoff_from ?? null,
                  batch?.cutoff_to ?? null,
                  payment.payment_date,
                );
                return (
                  <tr key={payment.id}>
                    <td className="px-3 py-2.5 font-mono">
                      {payment.payment_date}
                    </td>
                    <td className="px-3 py-2.5">
                      <strong className="block truncate">
                        {client?.label ?? branch?.label ?? "Unknown"}
                      </strong>
                      <span className="block truncate text-[10px] text-ink/45">
                        {client ? branch?.label : "Direct employee"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {period}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatPesos(payment.membership_fee_centavos)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatPesos(payment.capital_share_centavos)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatPesos(payment.amount_centavos)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-moss">
                      {payment.running_total_centavos === undefined ? "-" : formatPesos(payment.running_total_centavos)}
                    </td>
                    <td
                      className="truncate px-3 py-2.5 text-ink/60"
                      title={payment.method === "payroll_deduction" ? "Payroll Deduction" : "Payment"}
                    >
                      {payment.method === "payroll_deduction" ? "Payroll Deduction" : "Payment"}
                    </td>
                  </tr>
                );
              })}
              {!ledger ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-ink/45"
                  >
                    Loading payment history...
                  </td>
                </tr>
              ) : !payments.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-ink/45"
                  >
                    No payment history.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {refunds.length ? (
            <div className="border-t border-line">
              <h3 className="bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                Over-deduction refunds
              </h3>
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#f6f8f6] text-[10px] uppercase text-ink/45">
                  <tr>
                    <th className="px-3 py-2">Refund date</th>
                    <th className="px-3 py-2">Cut-off</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Remarks</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {refunds.map((refund) => (
                    <tr key={refund.id}>
                      <td className="px-3 py-2 font-mono">
                        {refund.refund_date}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {refund.cutoff_from && refund.cutoff_to
                          ? `${refund.cutoff_from} to ${refund.cutoff_to}`
                          : "Date only"}
                      </td>
                      <td className="px-3 py-2 capitalize">{refund.method}</td>
                      <td className="px-3 py-2">{refund.remarks || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatPesos(refund.amount_centavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={ledger?.paymentTotal ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </div>
  );
}
