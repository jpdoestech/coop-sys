import type { MemberInput } from "../../../types/member";

export type MemberPlacementTransfer = {
  effectiveDate: string;
  reason: string;
  workLocation: string | null;
};

export type MemberSubmission = {
  input: MemberInput;
  transfer: MemberPlacementTransfer | null;
};
