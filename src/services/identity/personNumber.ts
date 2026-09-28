type NumberedMember = { membership_number: string };
type NumberedEmployee = { employee_number: string };

export function normalizePersonNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(-6);
  return digits ? digits.padStart(6, "0") : "";
}

export function nextPersonNumber(members: NumberedMember[], employees: NumberedEmployee[]) {
  const values = [
    ...members.map((member) => normalizePersonNumber(member.membership_number)),
    ...employees.map((employee) => normalizePersonNumber(employee.employee_number)),
  ];
  const highest = values.reduce((maximum, value) => Math.max(maximum, Number(value) || 0), 0);
  if (highest >= 999999) throw new Error("The six-digit person number sequence is exhausted.");
  return String(highest + 1).padStart(6, "0");
}
