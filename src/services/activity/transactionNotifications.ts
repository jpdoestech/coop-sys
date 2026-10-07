import { create } from "zustand";

type Notice = { id: number; title: string; message: string; acknowledge: () => void };
export const useTransactionNotifications = create<{ notices: Notice[]; dismiss: () => void }>((set, get) => ({
  notices: [],
  dismiss: () => {
    const first = get().notices[0];
    if (!first) return;
    set((state) => ({ notices: state.notices.slice(1) }));
    first.acknowledge();
  },
}));
let sequence = 0;
export function showTransactionSuccess(title: string, message: string): Promise<void> {
  return new Promise((acknowledge) => useTransactionNotifications.setState((state) => ({ notices: [...state.notices, { id: ++sequence, title, message, acknowledge }] })));
}
