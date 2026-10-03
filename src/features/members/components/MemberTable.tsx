import { Archive, Pencil, Users } from "lucide-react";
import type { Member } from "../../../types/member";
import { memberStatuses, memberTypes, optionLabel } from "../data/memberOptions";
import { activeBeneficiaryCount } from "../../../types/beneficiary";

type MemberTableProps = {
  members: Member[];
  loading: boolean;
  onEdit: (member: Member) => void;
  onArchive: (member: Member) => void;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  selectedIds: Set<string>;
  onToggle: (memberId: string) => void;
  onTogglePage: (memberIds: string[], selected: boolean) => void;
};

function displayName(member: Member) {
  return [member.last_name, `${member.first_name}${member.middle_name ? ` ${member.middle_name[0]}.` : ""}`, member.suffix]
    .filter(Boolean)
    .join(", ");
}

export function MemberTable({ members, loading, onEdit, onArchive, canEdit, canDelete, canApprove, selectedIds, onToggle, onTogglePage }: MemberTableProps) {
  if (loading) {
    return <div className="border-t border-line px-5 py-12 text-center text-sm text-ink/60">Loading member records...</div>;
  }

  const pendingIds = members.filter((member) => member.bod_approval_status === "pending").map((member) => member.id);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  if (members.length === 0) {
    return (
      <div className="border-t border-line px-5 py-14 text-center">
        <Users className="mx-auto h-7 w-7 text-moss" />
        <p className="mt-3 text-sm font-semibold text-ink">No matching members</p>
        <p className="mt-1 text-sm text-ink/60">Adjust the search or create a new member record.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[62vh] overflow-auto border-t border-line">
      <table className="w-full min-w-[850px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-line bg-[#f8faf8] text-[10px] uppercase text-ink/45">
            {canApprove ? <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allPendingSelected} disabled={!pendingIds.length} onChange={(event) => onTogglePage(pendingIds, event.target.checked)} aria-label="Select all pending members on this page" className="h-3.5 w-3.5 accent-moss" /></th> : null}
            <th className="px-5 py-2.5 font-semibold">Member</th>
            <th className="px-4 py-2.5 font-semibold">Type</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Dependents</th>
            <th className="px-4 py-2.5 font-semibold">BOD approval</th>
            <th className="px-4 py-2.5 font-semibold">Contact</th>
            <th className="px-4 py-2.5 font-semibold">Joined</th>
            {canEdit || canDelete ? <th className="w-24 px-4 py-2.5 text-right font-semibold">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {members.map((member) => (
            <tr key={member.id} className="transition-colors hover:bg-[#f8faf8]">
              {canApprove ? <td className="px-3 py-2.5"><input type="checkbox" checked={selectedIds.has(member.id)} disabled={member.bod_approval_status !== "pending"} onChange={() => onToggle(member.id)} aria-label={`Select ${displayName(member)} for approval`} className="h-3.5 w-3.5 accent-moss disabled:opacity-30" /></td> : null}
              <td className="px-5 py-2.5">
                <p className="font-semibold text-ink">{displayName(member)}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink/45">{member.membership_number}</p>
              </td>
              <td className="px-4 py-2.5 text-ink/75">
                {optionLabel(memberTypes, member.membership_type_id)}
              </td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${member.membership_status_id === memberStatuses[0].id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${member.membership_status_id === memberStatuses[0].id ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {optionLabel(memberStatuses, member.membership_status_id)}
                </span>
              </td>
              <td className="px-4 py-2.5"><span className="font-semibold">{activeBeneficiaryCount(member.beneficiaries)}</span><span className="text-ink/35"> / 3</span></td>
              <td className="px-4 py-2.5">{member.bod_approval_status === "approved" ? <div><span className="font-medium text-emerald-700">Approved</span><p className="mt-0.5 font-mono text-[10px] text-ink/45">{member.acceptance_resolution_number}</p></div> : <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Pending</span>}</td>
              <td className="px-4 py-2.5">
                <p className="text-ink/80">{member.mobile_number || "No mobile"}</p>
                <p className="mt-0.5 text-xs text-ink/55">{member.email || "No email"}</p>
              </td>
              <td className="px-4 py-2.5 text-ink/70">{member.membership_date || "Not set"}</td>
              {canEdit || canDelete ? <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  {canEdit ? <button className="icon-button h-8 w-8" onClick={() => onEdit(member)} title="Edit member" aria-label={`Edit ${displayName(member)}`}>
                    <Pencil className="h-4 w-4" />
                  </button> : null}
                  {canDelete ? <button className="icon-button h-8 w-8 hover:border-red-100 hover:bg-red-50 hover:text-red-700" onClick={() => onArchive(member)} title="Archive member" aria-label={`Archive ${displayName(member)}`}>
                    <Archive className="h-4 w-4" />
                  </button> : null}
                </div>
              </td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
