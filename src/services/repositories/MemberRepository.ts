import type { Member, MemberInput } from "../../types/member";
import type { CrudRepository } from "./Repository";

export type MemberRepository = CrudRepository<Member, MemberInput> & {
  findByMembershipNumber(membershipNumber: string): Promise<Member | null>;
};
