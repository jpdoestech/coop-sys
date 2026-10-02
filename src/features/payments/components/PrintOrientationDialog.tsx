import {
  Printer,
  RectangleHorizontal,
  RectangleVertical,
  X,
} from "lucide-react";

export type PrintOrientation = "portrait" | "landscape";

type Props = {
  title: string;
  onSelect: (orientation: PrintOrientation) => void;
  onCancel: () => void;
};

export function PrintOrientationDialog({ title, onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-orientation-title"
        className="w-full max-w-sm overflow-hidden rounded-md border border-line bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[#e4efe9] text-moss">
              <Printer className="h-4 w-4" />
            </span>
            <div>
              <h2 id="print-orientation-title" className="text-sm font-bold">
                Print {title}
              </h2>
              <p className="text-[11px] text-ink/45">Choose page orientation</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Cancel printing"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 p-4">
          <button
            type="button"
            className="focus-ring group flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-4 text-center transition hover:border-moss hover:bg-[#f1f7f3]"
            onClick={() => onSelect("portrait")}
          >
            <RectangleVertical className="h-8 w-8 text-moss" />
            <span className="text-xs font-bold">Portrait</span>
            <span className="text-[10px] text-ink/45">Best for focused reports</span>
          </button>
          <button
            type="button"
            className="focus-ring group flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-4 text-center transition hover:border-moss hover:bg-[#f1f7f3]"
            onClick={() => onSelect("landscape")}
          >
            <RectangleHorizontal className="h-8 w-8 text-moss" />
            <span className="text-xs font-bold">Landscape</span>
            <span className="text-[10px] text-ink/45">Best for wide tables</span>
          </button>
        </div>

        <footer className="flex justify-end border-t border-line bg-[#fafbfa] px-4 py-3">
          <button type="button" className="secondary-button" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </footer>
      </section>
    </div>
  );
}
