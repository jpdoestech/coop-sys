import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "../../services/access/useAccess";
import { loadAttendancePreferences, saveAttendancePreferences, type AttendanceBlankMode } from "../../services/payroll/attendancePreferences";
export function AttendancePreferencesControl({ beforeChange }: { beforeChange?: (action: () => void) => void }) {
  const { profile } = useAccess(), client = useQueryClient();
  const key = ["attendance-preferences", profile.userId];
  const query = useQuery({ queryKey: key, queryFn: () => loadAttendancePreferences(profile) });
  const mutation = useMutation({ mutationFn: (mode: AttendanceBlankMode) => saveAttendancePreferences(profile, { blank_mode: mode }), onSuccess: async (_, mode) => { client.setQueryData(key, { blank_mode: mode }); } });
  return <div className="min-w-0"><label className="field-label">Blank scheduled workdays<select aria-label="Blank scheduled workdays" className="compact-control mt-1 w-full" value={query.data?.blank_mode || "present"} disabled={query.isPending || query.isError || mutation.isPending} onChange={(e) => { const mode = e.target.value as AttendanceBlankMode; const action = () => mutation.mutate(mode); if (beforeChange) beforeChange(action); else action(); }}><option value="present">Assumed present / encode exceptions</option><option value="absent">Assumed absent / encode present days</option></select></label>{query.isError || mutation.isError ? <p role="alert" className="mt-2 text-xs text-red-700">{query.error?.message || mutation.error?.message}</p> : null}</div>;
}
