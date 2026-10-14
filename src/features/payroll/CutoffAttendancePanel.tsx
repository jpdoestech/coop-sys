import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Settings2 } from "lucide-react";
import type { PayrollRun } from "../../types/payrollRun";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import { useConfirmLeave } from "../../components/forms/unsavedChanges";
import { AttendanceMatrix } from "./AttendanceMatrix";
import { AttendanceWorksheet } from "./AttendanceWorksheet";
import { AttendanceImportDialog } from "./AttendanceImportDialog";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { useAccess } from "../../services/access/useAccess";
export function CutoffAttendancePanel({ run, repository, payroll, attendance, employeeSearch = "" }: { run: PayrollRun; repository: PayrollRunRepository; payroll: PayrollRepository; attendance: AttendanceRepository; employeeSearch?: string }) {
  const [daily, setDaily] = useState(false), [importing, setImporting] = useState(false), leave = useConfirmLeave();
  const client = useQueryClient(), { can } = useAccess();
  const refresh = async () => { for (const key of ["attendance-matrix", "attendance", "attendance-team", "payroll-run-coverage", "payroll-calculation-preview", "payroll-setup"]) await client.invalidateQueries({ queryKey: [key] }); };
  return <div className="flex min-h-0 flex-1 flex-col">{daily ? <div className="data-toolbar"><button type="button" className="secondary-button" onClick={() => leave(() => setDaily(false))}>Cutoff grid</button></div> : null}{daily ? <div className="flex min-h-0 flex-1 flex-col"><AttendanceWorksheet employeeSearch={employeeSearch} run={run} payroll={payroll} repository={attendance} onImport={() => leave(() => setImporting(true))} /></div> : <AttendanceMatrix employeeSearch={employeeSearch} run={run} repository={repository} attendance={attendance} tools={<><ToolbarDisclosure label="More attendance options" icon={Settings2}><button type="button" className="secondary-button" onClick={() => leave(() => setDaily(true))}>Daily worksheet</button></ToolbarDisclosure>{can("payroll.manage") ? <button type="button" className="icon-button" title="Import cutoff attendance" aria-label="Import cutoff attendance" onClick={() => leave(() => setImporting(true))}><FileUp className="h-4 w-4" /></button> : null}</>} />}{importing ? <AttendanceImportDialog run={run} repository={attendance} payroll={payroll} onClose={() => setImporting(false)} refresh={refresh} /> : null}</div>;
}
