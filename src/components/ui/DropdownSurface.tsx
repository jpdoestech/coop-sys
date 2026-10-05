import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties, type RefObject } from "react";

export function DropdownSurface({ children, className = "", preferredWidth, anchorRef, ...props }: { children: ReactNode; className?: string; preferredWidth?: number; anchorRef?: RefObject<HTMLElement | null>; id?: string; role?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });
  useLayoutEffect(() => {
    const anchor = anchorRef?.current ?? ref.current?.parentElement;
    if (!anchor) return;
    function position() {
      const rect = anchor!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const below = topEdge + height - rect.bottom - 12;
      const above = rect.top - topEdge - 12;
      const up = below < 160 && above > below;
      const menuWidth = Math.min(preferredWidth ?? Math.max(rect.width, 240), width - 16);
      setStyle({ position: "fixed", zIndex: 100, width: menuWidth, left: Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + width - menuWidth - 8)),
        top: up ? undefined : rect.bottom + 4, bottom: up ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.max(60, Math.min(288, up ? above : below)), overflowY: "auto", overflowX: "hidden" });
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [preferredWidth, anchorRef]);
  return <div {...props} ref={ref} style={style} className={`rounded-md border border-line bg-white p-1 shadow-xl ${className}`}>{children}</div>;
}
