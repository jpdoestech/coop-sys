import { create } from "zustand";

export type ProgressReporter = (completed: number, total: number) => void;
export type ActivityTask = { label: string; startedAt: number; percentage?: number; completed?: number; total?: number };
type ActivityHandle = (() => void) & { report: ProgressReporter };
export const useActivityStore = create<{ tasks: Record<string, ActivityTask>; start: (label: string) => ActivityHandle }>((set) => ({
  tasks: {},
  start: (label) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ tasks: { ...state.tasks, [id]: { label, startedAt: Date.now() } } }));
    const done = () => set((state) => { const tasks = { ...state.tasks }; delete tasks[id]; return { tasks }; });
    return Object.assign(done, { report: (completed: number, total: number) => {
      if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return;
      set((state) => {
        const task = state.tasks[id];
        if (!task) return state;
        const count = Math.max(0, Math.min(total, completed));
        return { tasks: { ...state.tasks, [id]: { ...task, completed: count, total, percentage: Math.floor(count / total * 100) } } };
      });
    } });
  },
}));

export async function withActivity<T>(label: string, action: (report: ProgressReporter) => Promise<T>): Promise<T> {
  const done = useActivityStore.getState().start(label);
  try { return await action(done.report); } finally { done(); }
}
