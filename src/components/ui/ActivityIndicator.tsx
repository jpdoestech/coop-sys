import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useActivityStore } from "../../services/activity/activityStore";
import { LoadingProgress } from "./LoadingProgress";
import { useTransactionNotifications } from "../../services/activity/transactionNotifications";

export function ActivityIndicator() {
  const fetching = useIsFetching(), mutating = useIsMutating();
  const tasks = useActivityStore((state) => state.tasks);
  const entries = Object.entries(tasks);
  const task = [...entries].reverse().find(([, value]) => value.percentage !== undefined) || entries.at(-1);
  const notifying = useTransactionNotifications((state) => state.notices.length > 0);
  const busy = fetching + mutating + entries.length > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(busy), busy ? 500 : 0);
    return () => window.clearTimeout(timer);
  }, [busy]);
  if (!visible || !busy || notifying) return null;
  return <div className="fixed bottom-3 left-1/2 z-[100] w-80 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-md border border-line bg-white px-4 py-3 text-xs font-medium shadow-lg"><LoadingProgress key={task?.[0] || "query"} {...task?.[1]} label={task?.[1].label || (mutating ? "Saving changes..." : "Loading records...")} /></div>;
}
