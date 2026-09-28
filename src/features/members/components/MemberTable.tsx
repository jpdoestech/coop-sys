import { Archive, Pencil, Users } from "lucide-react";
import type { Member } from "../../../types/member";
import { memberStatuses, memberTypes, optionLabel } from "../data/memberOptions";

type MemberTableProps = {
  members: Member[];
  loading: boolean;
  onEdit: (member: Member) => void;
  onArchive: (member: Member) => void;
  canManage: boolean;
};

function displayName(member: Member) {
  return [member.last_name, `${member.first_name}${member.middle_name ? ` ${member.middle_name[0]}.` : ""}`, member.suffix]
    .filter(Boolean)
    .join(", ");
}

export function MemberTable({ members, loading, onEdit, onArchive, canManage }: MemberTableProps) {
  if (loading) {
    return <div className="border-t border-line px-5 py-12 text-center text-sm text-ink/60">Loading member records...</div>;
  }

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
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[850px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-ink text-xs uppercase text-white">
            <th className="px-5 py-3 font-semibold">Member</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Contact</th>
            <th className="px-4 py-3 font-semibold">Joined</th>
            {canManage ? <th className="w-24 px-4 py-3 text-right font-semibold">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {members.map((member) => (
            <tr key={member.id} className="transition-colors hover:bg-paper/70">
              <td className="px-5 py-3.5">
                <p className="font-semibold text-ink">{displayName(member)}</p>
                <p className="mt-0.5 font-mono text-xs text-ink/55">{member.membership_number}</p>
              </td>
              <td className="px-4 py-3.5 text-ink/75">
                {optionLabel(memberTypes, member.membership_type_id)}
              </td>
              {canManage ? <td className="px-4 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-ink/75">
                  <span className={`h-2 w-2 rounded-full ${member.membership_status_id === memberStatuses[0].id ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {optionLabel(memberStatuses, member.membership_status_id)}
                </span>
              </td> : null}
              <td className="px-4 py-3.5">
                <p className="text-ink/80">{member.mobile_number || "No mobile"}</p>
                <p className="mt-0.5 text-xs text-ink/55">{member.email || "No email"}</p>
              </td>
              <td className="px-4 py-3.5 text-ink/70">{member.membership_date || "Not set"}</td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end gap-1">
                  <button className="focus-ring rounded p-2 text-ink/65 hover:bg-paper hover:text-moss" onClick={() => onEdit(member)} title="Edit member" aria-label={`Edit ${displayName(member)}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="focus-ring rounded p-2 text-ink/65 hover:bg-red-50 hover:text-red-700" onClick={() => onArchive(member)} title="Archive member" aria-label={`Archive ${displayName(member)}`}>
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
