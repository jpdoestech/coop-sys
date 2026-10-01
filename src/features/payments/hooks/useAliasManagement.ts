import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "../../../services/access/accessControl";
import { assertPermission } from "../../../services/access/accessControl";
import { useAccess } from "../../../services/access/useAccess";
import { createPaymentRepository } from "../../../services/repositories/paymentRepositoryFactory";
import type { AliasInput } from "../../../services/repositories/PaymentRepository";

export function useAliasManagement(permission: Permission) {
  const repository = useMemo(() => createPaymentRepository(), []);
  const { profile } = useAccess();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["member-aliases", profile.userId], queryFn: async () => (await repository.getLedger({ limit: 1 })).aliases });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["member-aliases"] }); void queryClient.invalidateQueries({ queryKey: ["payment-ledger"] }); };
  const save = useMutation({ mutationFn: (input: AliasInput) => { assertPermission(profile, permission); return repository.saveAlias(input); }, onSuccess: refresh });
  const archive = useMutation({ mutationFn: (id: string) => { assertPermission(profile, permission); return repository.archiveAlias(id); }, onSuccess: refresh });
  return { query, save, archive };
}
