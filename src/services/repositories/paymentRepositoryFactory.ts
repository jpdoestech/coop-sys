import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { PaymentRepository } from "./PaymentRepository";
import { LocalPaymentRepository } from "./local/LocalPaymentRepository";
import { SupabasePaymentRepository } from "./supabase/SupabasePaymentRepository";

export function createPaymentRepository(): PaymentRepository {
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabasePaymentRepository();
  return new LocalPaymentRepository();
}
