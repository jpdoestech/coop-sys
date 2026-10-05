import { create } from "zustand";

export const useActivityStore = create<{ tasks: Record<string, string>; start: (label: string) => () => void }>((set) => ({
  tasks: {},
  start: (label) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ tasks: { ...state.tasks, [id]: label } }));
    return () => set((state) => { const tasks = { ...state.tasks }; delete tasks[id]; return { tasks }; });
  },
}));

export async function withActivity<T>(label: string, action: () => Promise<T>): Promise<T> {
  const done = useActivityStore.getState().start(label);
  try { return await action(); } finally { done(); }
}
