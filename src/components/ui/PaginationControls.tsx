import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <div className="flex flex-col gap-3 border-t border-line bg-paper/40 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-ink/60">Showing {start}-{end} of {total}</p>
    <div className="flex items-center gap-3"><label className="text-xs text-ink/60">Rows <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="focus-ring ml-1 rounded border border-line bg-white px-2 py-1.5"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><span className="min-w-20 text-center text-xs">Page {Math.min(page, pages)} of {pages}</span><button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="focus-ring rounded border border-line bg-white p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="focus-ring rounded border border-line bg-white p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div>
  </div>;
}
