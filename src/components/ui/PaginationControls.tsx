import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <div className="flex flex-col gap-2 border-t border-line bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
    <p className="text-xs text-ink/55">Showing <span className="font-semibold text-ink">{start}-{end}</span> of {total}</p>
    <div className="flex flex-wrap items-center gap-1.5"><label className="mr-auto whitespace-nowrap text-xs text-ink/55 sm:mr-2">Rows <select aria-label="Rows per page" value={pageSize} onChange={(event) => { onPageChange(1); onPageSizeChange(Number(event.target.value)); }} className="compact-control ml-1 w-20"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><span className="min-w-16 text-center text-xs text-ink/60">{Math.min(page, pages)} / {pages}</span><button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="icon-button shrink-0 border-line disabled:opacity-35" aria-label="Previous page" title="Previous page"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="icon-button shrink-0 border-line disabled:opacity-35" aria-label="Next page" title="Next page"><ChevronRight className="h-4 w-4" /></button></div>
  </div>;
}
