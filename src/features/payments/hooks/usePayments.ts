import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, employeeIsInScope, isBranchScoped } from "../../../services/access/accessControl";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import { createPaymentRepository } from "../../../services/repositories/paymentRepositoryFactory";
import type { AliasInput, PaymentBatchInput, PaymentLineInput, PaymentSettingsInput, SettlementInput } from "../../../services/repositories/PaymentRepository";

export function usePayments(page: number, pageSize: number, employeeSearch: string) {
  const paymentRepository = useMemo(() => createPaymentRepository(), []);
  const repositories = useMemo(() => createRepositories(), []);
  const { profile } = useAccess();
  const queryClient = useQueryClient();
  const employees = useQuery({
    queryKey: ["payment-employees", profile.userId],
    queryFn: async () => (await repositories.employees.list({ limit: 10000 })).filter((employee) => employeeIsInScope(employee, profile)),
  });
  const normalizedSearch = employeeSearch.trim().toLowerCase();
  const scopedEmployeeIds = employees.data?.filter((employee) => !normalizedSearch || [employee.employee_number, employee.first_name, employee.middle_name, employee.last_name, employee.suffix].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch)).map((employee) => employee.id);
  const employeeIds = normalizedSearch || isBranchScoped(profile) ? scopedEmployeeIds : undefined;
  const ledger = useQuery({ queryKey: ["payment-ledger", page, pageSize, employeeSearch, employeeIds], enabled: employees.isSuccess, queryFn: () => paymentRepository.getLedger({ limit: pageSize, offset: (page - 1) * pageSize, employeeIds }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["payment-ledger"] });
  const saveSettings = useMutation({ mutationFn: (input: PaymentSettingsInput) => { assertPermission(profile, "payments.settings.manage"); return paymentRepository.saveSettings(input); }, onSuccess: refresh });
  const saveAlias = useMutation({ mutationFn: (input: AliasInput) => { assertPermission(profile, "payments.manage"); return paymentRepository.saveAlias(input); }, onSuccess: refresh });
  const postBatch = useMutation({ mutationFn: ({ batch, lines }: { batch: PaymentBatchInput; lines: PaymentLineInput[] }) => { assertPermission(profile, "payments.manage"); return paymentRepository.postBatch(batch, lines); }, onSuccess: refresh });
  const settle = useMutation({ mutationFn: (input: SettlementInput) => { assertPermission(profile, "payments.manage"); return paymentRepository.settleFinalPay(input); }, onSuccess: refresh });
  const loadExportLedger = () => {
    assertPermission(profile, "payments.view");
    return paymentRepository.getLedger({ employeeIds: (employees.data ?? []).map((employee) => employee.id) });
  };
  return { ledger, employees, saveSettings, saveAlias, postBatch, settle, loadExportLedger };
}
