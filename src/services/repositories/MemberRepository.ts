import type { Member, MemberInput } from "../../types/member";
import type { CrudRepository } from "./Repository";

export type MemberRepository = CrudRepository<Member, MemberInput> & {
  findByMembershipNumber(membershipNumber: string): Promise<Member | null>;
  nextApprovalNumber(): Promise<string>;
  approve(ids: string[], approvalDate: string): Promise<string>;
};
