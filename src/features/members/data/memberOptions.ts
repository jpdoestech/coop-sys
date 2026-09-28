export const memberStatuses = [
  { id: "31000000-0000-4000-8000-000000000001", label: "Active" },
  { id: "31000000-0000-4000-8000-000000000002", label: "Inactive" },
  { id: "31000000-0000-4000-8000-000000000003", label: "Terminated" }
] as const;

export const memberTypes = [
  { id: "30000000-0000-4000-8000-000000000001", label: "Regular" },
  { id: "30000000-0000-4000-8000-000000000002", label: "Associate" },
  { id: "30000000-0000-4000-8000-000000000003", label: "Labor" }
] as const;

export function optionLabel(
  options: ReadonlyArray<{ id: string; label: string }>,
  value: string | null
) {
  return options.find((option) => option.id === value)?.label ?? "Not set";
}
