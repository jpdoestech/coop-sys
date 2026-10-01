import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "../../../services/access/useAccess";
import {
  assertPermission,
  employeeIsInScope,
  isBranchScoped,
} from "../../../services/access/accessControl";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import { createPaymentRepository } from "../../../services/repositories/paymentRepositoryFactory";
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
  const normalizedSearch = employeeSearch.trim().toLowerCase();
  const scopedEmployeeIds = employees.data
    ?.filter(
      (employee) =>
        !normalizedSearch ||
        [
          employee.employee_number,
          employee.first_name,
          employee.middle_name,
          employee.last_name,
          employee.suffix,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
    )
    .map((employee) => employee.id);
  const employeeIds =
    normalizedSearch || isBranchScoped(profile) ? scopedEmployeeIds : undefined;
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
      assertPermission(profile, "payments.manage");
      return paymentRepository.saveAlias(input);
    },
    onSuccess: refresh,
  });
  const archiveAlias = useMutation({
    mutationFn: (id: string) => {
      assertPermission(profile, "payments.manage");
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
      assertPermission(profile, "payments.manage");
      return paymentRepository.postBatch(batch, lines);
    },
    onSuccess: refresh,
  });
  const correctPayment = useMutation({
    mutationFn: (input: PaymentCorrectionInput) => {
      assertPermission(profile, "payments.manage");
      return paymentRepository.correctPayment(input);
    },
    onSuccess: refresh,
  });
  const saveRefund = useMutation({
    mutationFn: (input: RefundInput) => {
      assertPermission(profile, "payments.manage");
      return paymentRepository.saveRefund(input);
    },
    onSuccess: refresh,
  });
  const settle = useMutation({
    mutationFn: (input: SettlementInput) => {
      assertPermission(profile, "payments.manage");
      return paymentRepository.settleFinalPay(input);
    },
    onSuccess: refresh,
  });
  const loadExportLedger = useCallback(() => {
    assertPermission(profile, "payments.view");
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
      return paymentRepository.getRefundPage({
        ...options,
        branchIds:
          options.branchIds ??
          (isBranchScoped(profile) ? profile.branchIds : undefined),
      });
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
