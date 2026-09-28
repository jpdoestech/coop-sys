import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <div className="flex flex-col gap-3 border-t border-line bg-white px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-ink/55">Showing <span className="font-semibold text-ink">{start}-{end}</span> of {total}</p>
    <div className="flex items-center gap-2"><label className="mr-2 text-xs text-ink/55">Rows <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="focus-ring ml-1 rounded-md border border-line bg-white px-2 py-1.5 text-ink"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><span className="min-w-20 text-center text-xs text-ink/60">{Math.min(page, pages)} / {pages}</span><button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="icon-button border-line disabled:opacity-35" aria-label="Previous page" title="Previous page"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="icon-button border-line disabled:opacity-35" aria-label="Next page" title="Next page"><ChevronRight className="h-4 w-4" /></button></div>
  </div>;
}
