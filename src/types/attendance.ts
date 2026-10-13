import type { PayrollData } from "./payroll";
export type AttendanceStatus = "present" | "absent" | "paid_leave" | "unpaid_leave" | "rest_day";
export type AttendanceSegment = { time_in: string; time_out: string; in_next_day: boolean; out_next_day: boolean; break_minutes: number };
export type AttendanceInput = { employee_id: string; employee_label: string; work_date: string; status: AttendanceStatus; segments: AttendanceSegment[]; reason: string; terms_id: string; replace_id?: string | null; source_file?: string | null };
export type AttendanceRecord = Omit<AttendanceInput, "replace_id"> & { id: string; terms_snapshot: PayrollData; review_status: "draft" | "approved"; created_by: string; created_at: string; updated_at: string; reviewed_by: string | null; reviewed_at: string | null; deleted_at: string | null; supersedes_id: string | null };
export type AttendanceQuery = { search?: string; dateFrom?: string; dateTo?: string; employeeId?: string; reviewStatus?: "draft" | "approved"; includeArchived?: boolean; limit?: number; offset?: number };
