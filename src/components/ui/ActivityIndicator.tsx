import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useActivityStore } from "../../services/activity/activityStore";

export function ActivityIndicator() {
  const fetching = useIsFetching(), mutating = useIsMutating();
  const tasks = useActivityStore((state) => state.tasks);
  const labels = Object.values(tasks);
  const busy = fetching + mutating + labels.length > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(busy), busy ? 500 : 0);
    return () => window.clearTimeout(timer);
  }, [busy]);
  if (!visible || !busy) return null;
  return <div role="status" aria-live="polite" className="fixed bottom-3 left-1/2 z-[100] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-xs font-medium shadow-lg"><LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-moss" /><span className="min-w-0">{labels.at(-1) || (mutating ? "Saving changes..." : "Loading records...")}</span></div>;
}
