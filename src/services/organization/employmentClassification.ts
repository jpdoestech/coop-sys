import type { OrganizationDepartment, OrganizationPosition } from "../../types/organization";

export type EmploymentClassification = { department_id?: string | null; position_id?: string | null; pending_department_name?: string | null; pending_position_name?: string | null };
type Department = Pick<OrganizationDepartment, "id" | "label"> & { isActive?: boolean };
type Position = Pick<OrganizationPosition, "id" | "label" | "departmentId"> & { isActive?: boolean };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function resolveEmploymentClassification(departmentText: string, positionText: string, departments: readonly Department[], positions: readonly Position[]): EmploymentClassification {
  const department = departments.find((item) => item.isActive !== false && (item.id === departmentText || normalize(item.label) === normalize(departmentText)));
  const position = positions.find((item) => item.isActive !== false && (item.id === positionText || normalize(item.label) === normalize(positionText)) && (!department || item.departmentId === department.id));
  const inferredDepartment = !departmentText && position ? departments.find((item) => item.id === position.departmentId && item.isActive !== false) : undefined;
  const resolvedDepartment = department || inferredDepartment;
  const resolvedPosition = resolvedDepartment && position?.departmentId === resolvedDepartment.id ? position : undefined;
  return { department_id: resolvedDepartment?.id || null, position_id: resolvedPosition?.id || null, pending_department_name: departmentText && !resolvedDepartment ? departmentText.trim().replace(/\s+/g, " ") : null, pending_position_name: positionText && !resolvedPosition ? positionText.trim().replace(/\s+/g, " ") : null };
}
