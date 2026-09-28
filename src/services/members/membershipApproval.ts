import type { Member } from "../../types/member";

export function nextBodResolutionNumber(members: Member[]) {
  const highest = members.reduce((maximum, member) => {
    const token = member.acceptance_resolution_number?.split("-").at(-1) ?? "";
    const digits = token.replace(/\D/g, "").slice(-6);
    return Math.max(maximum, Number(digits) || 0);
  }, 0);
  if (highest >= 999999) throw new Error("The six-digit BOD resolution sequence is exhausted.");
  return String(highest + 1).padStart(6, "0");
}
