import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member, MemberInput } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, employeeIsInScope, isBranchScoped } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import { nextBodResolutionNumber } from "../../../services/members/membershipApproval";
import { MEMBER_STATUS } from "../../../services/lookups/statuses";
import type { PersonImportRow } from "../../../services/imports/personImport";
import { memberInputSchema } from "../../../services/validation/memberSchema";
import { memberTypes } from "../data/memberOptions";
import type { ListOptions } from "../../../services/repositories/Repository";

export function useMembers(options: ListOptions) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const queryKey = ["members", "page", options];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      return repositories.members.listPage(options);
    }
  });
  const placementEmployees = useQuery({
    queryKey: ["member-placement-employees"],
    queryFn: async () => (await repositories.employees.list({ limit: 1000 })).filter((employee) => employeeIsInScope(employee, profile)),
  });
  const personNumber = useQuery({
    queryKey: ["next-person-number"],
    queryFn: async () => nextPersonNumber(
      await repositories.members.list({ includeDeleted: true, limit: 10000 }),
      await repositories.employees.list({ includeDeleted: true, limit: 10000 }),
    ),
  });
  const approvalSequence = useQuery({
    queryKey: ["next-bod-resolution"],
    queryFn: async () => nextBodResolutionNumber(await repositories.members.list({ limit: 10000 })),
  });

  const saveMember = useMutation({
    mutationFn: async ({ member, input }: { member: Member | null; input: MemberInput }) => {
      assertPermission(profile, member ? "members.update" : "members.create");
      if (!member && isBranchScoped(profile)) throw new Error("Create branch members from the employee workflow so their branch scope is recorded.");
      if (member && isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(member.id);
        if (!linked.some((employee) => employeeIsInScope(employee, profile))) throw new Error("This member is outside your assigned branches.");
      }
      const saved = member
        ? await repositories.members.update(member.id, input)
        : await repositories.members.create({ ...input, membership_number: personNumber.data ?? input.membership_number });
      const linkedEmployees = await repositories.employees.listByMemberId(saved.id);
      await Promise.all(
        linkedEmployees.map((linkedEmployee) =>
          repositories.employees.update(linkedEmployee.id, employeeProfileFromMember(saved)),
        ),
      );
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
      queryClient.invalidateQueries({ queryKey: ["next-bod-resolution"] });
      queryClient.invalidateQueries({ queryKey: ["next-person-number"] });
    }
  });

  const archiveMember = useMutation({
    mutationFn: async (id: string) => {
      assertPermission(profile, "members.delete");
      if (isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(id);
        if (!linked.some((employee) => employeeIsInScope(employee, profile))) throw new Error("This member is outside your assigned branches.");
      }
      return repositories.members.archive(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] })
  });

  const approveMembers = useMutation({
    mutationFn: async ({ ids, approvalDate }: { ids: string[]; approvalDate: string }) => {
      assertPermission(profile, "members.approve");
      if (!ids.length) throw new Error("Select at least one pending member.");
      const allMembers = await repositories.members.list({ limit: 10000 });
      const selected = allMembers.filter((member) => ids.includes(member.id));
      if (selected.length !== ids.length || selected.some((member) => member.bod_approval_status !== "pending")) {
        throw new Error("Only pending membership applications can be approved.");
      }
      const resolutionNumber = nextBodResolutionNumber(allMembers);
      await Promise.all(selected.map(async (member) => {
        const saved = await repositories.members.update(member.id, {
          bod_approval_status: "approved",
          acceptance_date: approvalDate,
          acceptance_resolution_number: resolutionNumber,
          membership_status_id: MEMBER_STATUS.active,
        });
        const linkedEmployees = await repositories.employees.listByMemberId(saved.id);
        await Promise.all(linkedEmployees.map((employee) => repositories.employees.update(employee.id, employeeProfileFromMember(saved))));
      }));
      return resolutionNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
    },
  });

  const importMembers = useMutation({
    mutationFn: async (rows: PersonImportRow[]) => {
      assertPermission(profile, "members.import");
      if (isBranchScoped(profile)) throw new Error("Branch users must import employees so placement scope is recorded.");
      const [members, employees] = await Promise.all([
        repositories.members.list({ includeDeleted: true, limit: 10000 }),
        repositories.employees.list({ includeDeleted: true, limit: 10000 }),
      ]);
      const used = new Set([...members.map((item) => item.membership_number), ...employees.map((item) => item.employee_number)]);
      const imported = new Set<string>();
      let sequence = Number(nextPersonNumber(members, employees));
      const inputs = rows.map((row) => {
        const linkedEmployee = row.linkedRecordId ? employees.find((item) => item.id === row.linkedRecordId) : null;
        if (row.linkedRecordId && !linkedEmployee) throw new Error(`Row ${row.rowNumber}: linked employee was not found.`);
        if (linkedEmployee?.member_id) throw new Error(`Row ${row.rowNumber}: linked employee already has a member record.`);
        if (linkedEmployee && row.personNumber && row.personNumber !== linkedEmployee.employee_number) throw new Error(`Row ${row.rowNumber}: imported ID does not match the linked employee ID.`);
        let number = linkedEmployee?.employee_number ?? row.personNumber;
        if (!number) { while (used.has(String(sequence).padStart(6, "0"))) sequence += 1; number = String(sequence++).padStart(6, "0"); }
        if (members.some((item) => item.membership_number === number) || imported.has(number)) throw new Error(`Row ${row.rowNumber}: ID ${number} already exists.`); used.add(number); imported.add(number);
        const input: MemberInput = { membership_number: number, first_name: row.firstName, middle_name: row.middleName || null, last_name: row.lastName, suffix: row.suffix || null, date_of_birth: row.birthDate || null, sex: null, civil_status: null, mobile_number: row.mobile || null, email: row.email || null, address: row.address || null, barangay: row.barangay || null, city_municipality: row.city || null, province: row.province || null, postal_code: row.postalCode || null, membership_date: row.membershipDate || new Date().toISOString().slice(0, 10), membership_status_id: MEMBER_STATUS.inactive, membership_type_id: memberTypes[1].id, member_category: null, religion_affiliation_id: null, sss_number: null, pagibig_number: null, philhealth_number: null, tax_identification_number: null, acceptance_resolution_number: null, acceptance_date: null, bod_approval_status: "pending", highest_educational_attainment: null, occupation_income_source: "Employed / Salary", annual_income: null, number_of_dependents: 0, beneficiary_name: null, religion_affiliation: null, termination_date: null, termination_reason: null, emergency_contact: null, notes: "Imported from Excel", profile_photo_ref: null, beneficiaries: [] };
        return { input: memberInputSchema.parse(input) as MemberInput, linkedEmployee };
      });
      for (const record of inputs) { const saved = await repositories.members.create(record.input); if (record.linkedEmployee) await repositories.employees.update(record.linkedEmployee.id, employeeProfileFromMember(saved)); }
      return inputs.length;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["members"] }); queryClient.invalidateQueries({ queryKey: ["next-person-number"] }); },
  });

  return { query, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers, importMembers };
}
