import { useConfirmLeave } from "../../components/forms/unsavedChanges";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ChartNoAxesCombined,
  Download,
  FileUp,
  History,
  RotateCcw,
  Settings2,
  Tags,
  Undo2,
} from "lucide-react";
import { Info } from "lucide-react";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { PageHeader } from "../../components/ui/PageHeader";
import { useWorkspacePath } from "../../components/layout/WorkspaceNavigation";
import { useAccess } from "../../services/access/useAccess";
import { placementOptions } from "../../services/access/placementOptions";
import { useOrganization } from "../../services/organization/useOrganization";
import {
  effectiveSettings,
  formatPesos,
} from "../../services/payments/paymentMath";
import type { MemberPayment, PaymentLedger } from "../../types/payment";
import { usePayments } from "./hooks/usePayments";
import { ManualPaymentPanel } from "./components/ManualPaymentPanel";
import { PaymentImportPanel } from "./components/PaymentImportPanel";
import { FinalPayPanel } from "./components/FinalPayPanel";
import { PaymentSettingsPanel } from "./components/PaymentSettingsPanel";
import { PaymentExportPanel } from "./components/PaymentExportPanel";
import { AliasImportPanel } from "./components/AliasImportPanel";
import { RefundPanel } from "./components/RefundPanel";
import { PaymentCorrectionDialog } from "./components/PaymentCorrectionDialog";
import {
  TransactionsPanel,
  type TransactionFilters,
} from "./components/TransactionsPanel";
import { parseYearFilter } from "./paymentFilters";
import { PaymentSummaryPanel } from "./components/PaymentSummaryPanel";

type Tab =
  | "ledger"
  | "summary"
  | "manual"
  | "import"
  | "aliases"
  | "refunds"
  | "final"
  | "export"
  | "settings";
const emptyLedger: PaymentLedger = {
  settings: [],
  aliases: [],
  batches: [],
  payments: [],
  settlements: [],
  corrections: [],
  refunds: [],
  paymentTotal: 0,
  refundTotal: 0,
};

export function PaymentsPage() {
  const { profile, can } = useAccess();
  const isSuperAdmin = profile.role === "super_admin";
  const { branches, clients } = useOrganization();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tab, setTab] = useState<Tab>("summary");
  const tabNames: Record<Tab, string> = { ledger: "Transactions", summary: "Payment Summary", manual: "Manual Payment", import: "Payroll Import", aliases: "Import Aliases", refunds: "Refunds", final: "Final Pay", export: "Export", settings: "Settings" };
  useWorkspacePath([{ label: "Payments", onSelect: () => setTab("ledger") }, { label: tabNames[tab] }]);
  const confirmLeave = useConfirmLeave();
  const [editingPayment, setEditingPayment] = useState<MemberPayment | null>(
    null,
  );
  const [filters, setFilters] = useState<TransactionFilters>({
    employeeSearch: "",
    year: String(new Date().getFullYear()),
    placement: null,
    sortBy: "date",
    sortDirection: "desc",
  });
  const deferredSearch = useDeferredValue(filters.employeeSearch);
  const deferredYear = useDeferredValue(filters.year);
  const parsedYear = parseYearFilter(deferredYear);
  const queryFilters = useMemo(
    () => ({
      yearFrom: parsedYear?.yearFrom,
      yearTo: parsedYear?.yearTo,
      branchIds:
        filters.placement?.kind === "branch"
          ? [filters.placement.id]
          : undefined,
      clientIds:
        filters.placement?.kind === "client"
          ? [filters.placement.id]
          : undefined,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    }),
    [
      parsedYear?.yearFrom,
      parsedYear?.yearTo,
      filters.placement,
      filters.sortBy,
      filters.sortDirection,
    ],
  );
  const payments = usePayments(page, pageSize, deferredSearch, queryFilters);
  const ledger = payments.ledger.data ?? emptyLedger;
  const employees = payments.employees.data ?? [];
  const { branches: allowedBranches, clients: allowedClients } = placementOptions(profile, branches, clients);
  const allowedBranchIds = new Set(allowedBranches.map((branch) => branch.id));
  const currentSettings = effectiveSettings(
    ledger.settings,
    new Date().toISOString().slice(0, 10),
  );
  const tabs: Array<{
    id: Tab;
    label: string;
    icon: typeof History;
    visible: boolean;
  }> = [
    { id: "ledger", label: "Transactions", icon: History, visible: true },
    {
      id: "summary",
      label: "Payment summary",
      icon: ChartNoAxesCombined,
      visible: can("payments.view"),
    },
    {
      id: "manual",
      label: "Manual payment",
      icon: Banknote,
      visible: can("payments.create"),
    },
    {
      id: "import",
      label: "Payroll import",
      icon: FileUp,
      visible: can("payments.import"),
    },
    {
      id: "aliases",
      label: "Import aliases",
      icon: Tags,
      visible: can("payments.update") || can("payments.import"),
    },
    {
      id: "refunds",
      label: "Refunds",
      icon: Undo2,
      visible: can("payments.create"),
    },
    {
      id: "final",
      label: "Final pay",
      icon: RotateCcw,
      visible: can("payments.create"),
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      visible: can("payments.export"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings2,
      visible: isSuperAdmin && can("payments.settings.manage"),
    },
  ];
  const post = (
    batch: Parameters<typeof payments.postBatch.mutate>[0]["batch"],
    lines: Parameters<typeof payments.postBatch.mutate>[0]["lines"],
  ) =>
    payments.postBatch.mutate(
      { batch, lines },
      { onSuccess: () => setTab("ledger") },
    );

  useEffect(
    () => setPage(1),
    [
      deferredSearch,
      deferredYear,
      filters.placement,
      filters.sortBy,
      filters.sortDirection,
    ],
  );

  useEffect(() => {
    if (tab === "settings" && !isSuperAdmin) setTab("summary");
  }, [isSuperAdmin, tab]);

  const mutationError =
    payments.postBatch.error ??
    payments.saveSettings.error ??
    payments.settle.error ??
    payments.saveAlias.error ??
    payments.saveRefund.error;
  return (
    <>
      <PageHeader title="Payments" />
      <div className="flex items-center gap-1 border-b border-line bg-white">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex min-w-max gap-1 bg-white p-1">
          {tabs
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { if (item.id !== tab) confirmLeave(() => setTab(item.id)); }}
                className={`focus-ring inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded px-2 text-xs font-semibold transition ${tab === item.id ? "bg-[#e4efe9] text-moss" : "text-ink/55 hover:bg-paper hover:text-ink"}`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
        </div>
      </div>
        <div className="shrink-0 px-1"><ToolbarDisclosure label="Payment obligation" icon={Info}>
          <p className="text-xs text-ink/65">{currentSettings ? `${formatPesos(currentSettings.membership_fee_centavos + currentSettings.capital_share_target_centavos)} default obligation` : "No active settings"}</p>
          {currentSettings ? <dl className="grid grid-cols-2 gap-2 text-xs"><dt>Membership fee</dt><dd className="text-right font-mono">{formatPesos(currentSettings.membership_fee_centavos)}</dd><dt>Share capital target</dt><dd className="text-right font-mono">{formatPesos(currentSettings.capital_share_target_centavos)}</dd></dl> : null}
        </ToolbarDisclosure></div>
      </div>
      <section className="overflow-hidden rounded-b-md border border-t-0 border-line bg-white">
        {payments.ledger.isError || payments.employees.isError ? (
          <p className="p-5 text-sm text-red-700">
            Payment records could not be loaded.
          </p>
        ) : null}
        {mutationError ? (
          <p className="border-b border-line bg-red-50 px-4 py-2 text-xs text-red-700">
            {mutationError.message}
          </p>
        ) : null}
        {tab === "ledger" ? (
          <TransactionsPanel
            ledger={ledger}
            employees={employees}
            branches={allowedBranches}
            clients={allowedClients}
            filters={filters}
            yearError={Boolean(deferredYear.trim() && !parsedYear)}
            page={page}
            pageSize={pageSize}
            canEdit={can("payments.update")}
            onFiltersChange={setFilters}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onEdit={setEditingPayment}
          />
        ) : null}
        {tab === "summary" ? (
          <PaymentSummaryPanel
            branches={allowedBranches}
            clients={allowedClients}
            batches={ledger.batches.filter((batch) =>
              allowedBranchIds.has(batch.branch_id),
            )}
            onLoadSummary={payments.loadPaymentSummary}
            onLoadEmployeeLedger={payments.loadEmployeeLedger}
          />
        ) : null}
        {tab === "manual" ? (
          <ManualPaymentPanel
            employees={employees}
            branches={allowedBranches}
            clients={allowedClients}
            userId={profile.userId}
            saving={payments.postBatch.isPending}
            onPost={post}
          />
        ) : null}
        {tab === "import" ? (
          <PaymentImportPanel
            employees={employees}
            aliases={ledger.aliases}
            branches={allowedBranches}
            clients={allowedClients}
            userId={profile.userId}
            saving={payments.postBatch.isPending}
            onSaveAlias={payments.saveAlias.mutateAsync}
            onPost={post}
          />
        ) : null}
        {tab === "aliases" ? (
          <AliasImportPanel
            employees={employees}
            aliases={ledger.aliases}
            branches={allowedBranches}
            clients={allowedClients}
            saving={payments.saveAlias.isPending}
            onSaveAlias={payments.saveAlias.mutateAsync}
          />
        ) : null}
        {tab === "refunds" ? (
          <RefundPanel
            employees={employees}
            branches={allowedBranches}
            clients={allowedClients}
            userId={profile.userId}
            saving={payments.saveRefund.isPending}
            onLoadRefunds={payments.loadRefunds}
            onSave={payments.saveRefund.mutateAsync}
          />
        ) : null}
        {tab === "final" ? (
          <FinalPayPanel
            employees={employees}
            payments={ledger.payments}
            settlements={ledger.settlements}
            userId={profile.userId}
            saving={payments.settle.isPending}
            onSettle={(input) =>
              payments.settle.mutate(input, {
                onSuccess: () => setTab("ledger"),
              })
            }
          />
        ) : null}
        {tab === "export" ? (
          <PaymentExportPanel
            employees={employees}
            branches={allowedBranches}
            clients={allowedClients}
            onLoadLedger={payments.loadExportLedger}
          />
        ) : null}
        {tab === "settings" && isSuperAdmin ? (
          <PaymentSettingsPanel
            settings={ledger.settings}
            saving={payments.saveSettings.isPending}
            onSave={(input) => payments.saveSettings.mutateAsync(input)}
          />
        ) : null}
      </section>
      {editingPayment ? (
        <PaymentCorrectionDialog
          payment={editingPayment}
          userId={profile.userId}
          saving={payments.correctPayment.isPending}
          error={payments.correctPayment.error?.message}
          onClose={() => {
            payments.correctPayment.reset();
            setEditingPayment(null);
          }}
          onSave={(input) =>
            payments.correctPayment.mutate(input, {
              onSuccess: () => setEditingPayment(null),
            })
          }
        />
      ) : null}
    </>
  );
}
