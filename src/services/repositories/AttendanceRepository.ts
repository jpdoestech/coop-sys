import type { AttendanceInput, AttendanceQuery, AttendanceRecord } from "../../types/attendance";
import type { AttendanceTeamPage, AttendanceTeamQuery } from "../payroll/attendanceTeam";
export interface AttendanceRepository {
  list(query: AttendanceQuery): Promise<{ items: AttendanceRecord[]; total: number }>;
  saveBatch(input: AttendanceInput[]): Promise<void>;
  saveCutoffBatch(runId: string, input: AttendanceInput[]): Promise<void>;
  approve(id: string): Promise<void>;
  worksheet(query: AttendanceTeamQuery): Promise<AttendanceTeamPage>;
}
