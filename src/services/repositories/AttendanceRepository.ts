import type { AttendanceInput, AttendanceQuery, AttendanceRecord } from "../../types/attendance";
export interface AttendanceRepository {
  list(query: AttendanceQuery): Promise<{ items: AttendanceRecord[]; total: number }>;
  saveBatch(input: AttendanceInput[]): Promise<void>;
  approve(id: string): Promise<void>;
}
