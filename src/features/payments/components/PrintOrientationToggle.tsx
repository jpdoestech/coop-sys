import { RectangleHorizontal, RectangleVertical } from "lucide-react";

export type PrintOrientation = "portrait" | "landscape";

type Props = {
  value: PrintOrientation;
  onChange: (value: PrintOrientation) => void;
};

export function PrintOrientationToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-line bg-paper p-0.5" role="group" aria-label="Print orientation">
      <button type="button" title="Portrait" aria-label="Portrait print orientation" aria-pressed={value === "portrait"} onClick={() => onChange("portrait")} className={`focus-ring inline-flex h-7 items-center gap-1.5 rounded px-2 text-[11px] font-semibold transition ${value === "portrait" ? "bg-white text-moss shadow-sm" : "text-ink/45 hover:text-ink"}`}>
        <RectangleVertical className="h-3.5 w-3.5" /> Portrait
      </button>
      <button type="button" title="Landscape" aria-label="Landscape print orientation" aria-pressed={value === "landscape"} onClick={() => onChange("landscape")} className={`focus-ring inline-flex h-7 items-center gap-1.5 rounded px-2 text-[11px] font-semibold transition ${value === "landscape" ? "bg-white text-moss shadow-sm" : "text-ink/45 hover:text-ink"}`}>
        <RectangleHorizontal className="h-3.5 w-3.5" /> Landscape
      </button>
    </div>
  );
}
