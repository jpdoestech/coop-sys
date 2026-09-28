import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import { LocalMemberRepository } from "./local/LocalMemberRepository";
import type { MemberRepository } from "./MemberRepository";
import { SupabaseMemberRepository } from "./supabase/SupabaseMemberRepository";
import type { EmployeeRepository } from "./EmployeeRepository";
import { LocalEmployeeRepository } from "./local/LocalEmployeeRepository";
import { SupabaseEmployeeRepository } from "./supabase/SupabaseEmployeeRepository";

export type RepositorySet = {
  members: MemberRepository;
  employees: EmployeeRepository;
};

export function createRepositories(): RepositorySet {
  const appMode = getAppMode();

  if (appMode === "ONLINE") {
    return { members: new SupabaseMemberRepository(), employees: new SupabaseEmployeeRepository() };
  }

  if (appMode === "AUTO" && isSupabaseConfigured && navigator.onLine) {
    return { members: new SupabaseMemberRepository(), employees: new SupabaseEmployeeRepository() };
  }

  return { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
}
