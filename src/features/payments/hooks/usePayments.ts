import { useCallback, useMemo } from "react";
import { matchesPersonSearch, personSearchTerms } from "../../../services/identity/personSearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "../../../services/access/useAccess";
import {
  assertPermission,
  employeeIsInScope,
  isBranchScoped,
} from "../../../services/access/accessControl";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import { createPaymentRepository } from "../../../services/repositories/paymentRepositoryFactory";
import { withActivity } from "../../../services/activity/activityStore";
import { showTransactionSuccess } from "../../../services/activity/transactionNotifications";
import { assertRefundAmount, refundableBalance } from "../../../services/payments/paymentBalance";
import type {
  AliasInput,
  PaymentBatchInput,
  PaymentCorrectionInput,
  PaymentLineInput,
  PaymentQueryOptions,
  PaymentSettingsInput,
  PaymentSummaryQueryOptions,
  RefundInput,
  RefundQueryOptions,
  SettlementInput,
} from "../../../services/repositories/PaymentRepository";

export function usePayments(
  page: number,
  pageSize: number,
  employeeSearch: string,
  filters: Omit<PaymentQueryOptions, "limit" | "offset" | "employeeIds"> = {},
) {
  const paymentRepository = useMemo(() => createPaymentRepository(), []);
  const repositories = useMemo(() => createRepositories(), []);
  const { profile } = useAccess();
  const queryClient = useQueryClient();
  const employees = useQuery({
    queryKey: ["payment-employees", profile.userId],
    queryFn: async () =>
      (await repositories.employees.list({ limit: 10000 })).filter((employee) =>
        employeeIsInScope(employee, profile),
      ),
  });
  const searchTerms = personSearchTerms(employeeSearch);
  const scopedEmployeeIds = employees.data
    ?.filter(
      (employee) =>
        matchesPersonSearch(searchTerms, [
          employee.employee_number,
          employee.first_name,
          employee.middle_name,
          employee.last_name,
          employee.suffix,
        ]),
    )
    .map((employee) => employee.id);
  const employeeIds =
    searchTerms.length || isBranchScoped(profile) ? scopedEmployeeIds : undefined;
  const ledger = useQuery({
    queryKey: [
      "payment-ledger",
      page,
      pageSize,
      employeeSearch,
      employeeIds,
      filters,
    ],
    enabled: employees.isSuccess,
    queryFn: () =>
      paymentRepository.getLedger({
        ...filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        employeeIds,
      }),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["payment-ledger"] });
  const saveSettings = useMutation({
    mutationFn: (input: PaymentSettingsInput) => {
      assertPermission(profile, "payments.settings.manage");
      return paymentRepository.saveSettings(input);
    },
    onSuccess: refresh,
  });
  const saveAlias = useMutation({
    mutationFn: (input: AliasInput) => {
      assertPermission(profile, "payments.update");
      return paymentRepository.saveAlias(input);
    },
    onSuccess: refresh,
  });
  const archiveAlias = useMutation({
    mutationFn: (id: string) => {
      assertPermission(profile, "payments.delete");
      return paymentRepository.archiveAlias(id);
    },
    onSuccess: refresh,
  });
  const postBatch = useMutation({
    mutationFn: ({
      batch,
      lines,
    }: {
      batch: PaymentBatchInput;
      lines: PaymentLineInput[];
    }) => {
      assertPermission(profile, batch.method === "payroll_deduction" ? "payments.import" : "payments.create");
      return withActivity(`Posting ${lines.length} payment transactions...`, (report) => paymentRepository.postBatch(batch, lines, report));
    },
    onSuccess: async (_result, { batch, lines }) => {
      await showTransactionSuccess(batch.method === "payroll_deduction" ? "Payroll import completed" : "Payment saved", `${lines.length} payment transactions posted successfully.`);
      await refresh();
    },
  });
  const correctPayment = useMutation({
    mutationFn: (input: PaymentCorrectionInput) => {
      assertPermission(profile, "payments.update");
      return paymentRepository.correctPayment(input);
    },
    onSuccess: refresh,
  });
  const saveRefund = useMutation({
    mutationFn: async (input: RefundInput) => {
      assertPermission(profile, "payments.create");
      const employee = await repositories.employees.getById(input.employee_id);
      if (!employee || employee.member_id !== input.member_id || !employeeIsInScope(employee, profile)) throw new Error("This employee is outside your access scope.");
      const ledger = await paymentRepository.getLedger({ employeeIds: [input.employee_id] });
      assertRefundAmount(input.amount_centavos, refundableBalance(ledger.payments, ledger.refunds, ledger.settings, input.employee_id, input.refund_date, input.id));
      return paymentRepository.saveRefund(input);
    },
    onSuccess: refresh,
  });
  const settle = useMutation({
    mutationFn: (input: SettlementInput) => {
      assertPermission(profile, "payments.create");
      return paymentRepository.settleFinalPay(input);
    },
    onSuccess: refresh,
  });
  const loadExportLedger = useCallback(() => {
    assertPermission(profile, "payments.export");
    return paymentRepository.getLedger({
      employeeIds: (employees.data ?? []).map((employee) => employee.id),
    });
  }, [employees.data, paymentRepository, profile]);
  const loadPaymentSummary = useCallback(
    (options: PaymentSummaryQueryOptions) => {
      assertPermission(profile, "payments.view");
      return paymentRepository.getPaymentSummary({
        ...options,
        branchIds:
          options.branchIds ??
          (isBranchScoped(profile) ? profile.branchIds : undefined),
      });
    },
    [paymentRepository, profile],
  );
  const loadEmployeeLedger = useCallback(
    (
      employeeId: string,
      options: Pick<PaymentQueryOptions, "limit" | "offset"> = {},
    ) => {
      assertPermission(profile, "payments.view");
      if (!employees.data?.some((employee) => employee.id === employeeId))
        throw new Error("This employee is outside your access scope.");
      return paymentRepository.getLedger({
        employeeIds: [employeeId],
        ...options,
      });
    },
    [employees.data, paymentRepository, profile],
  );
  const loadRefunds = useCallback(
    (options: RefundQueryOptions) => {
      assertPermission(profile, "payments.view");
      return withActivity("Loading refunds...", () => paymentRepository.getRefundPage({
        ...options,
        branchIds:
          options.branchIds ??
          (isBranchScoped(profile) ? profile.branchIds : undefined),
      }));
    },
    [paymentRepository, profile],
  );
  return {
    ledger,
    employees,
    saveSettings,
    saveAlias,
    archiveAlias,
    postBatch,
    correctPayment,
    saveRefund,
    settle,
    loadExportLedger,
    loadPaymentSummary,
    loadEmployeeLedger,
    loadRefunds,
  };
}
