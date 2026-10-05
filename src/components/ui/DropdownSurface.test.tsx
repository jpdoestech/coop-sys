import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropdownSurface } from "./DropdownSurface";

describe("DropdownSurface", () => {
  afterEach(() => vi.restoreAllMocks());
  it("keeps wide menus inside a narrow viewport and opens above near the bottom", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 260, right: 360, top: 560, bottom: 600, width: 100, height: 40, x: 260, y: 560, toJSON() {} });
    vi.stubGlobal("innerWidth", 375);
    vi.stubGlobal("innerHeight", 667);
    render(<div><DropdownSurface role="listbox" preferredWidth={340}>Locations</DropdownSurface></div>);
    const menu = screen.getByRole("listbox");
    expect(menu.style.width).toBe("340px");
    expect(menu.style.left).toBe("27px");
    expect(menu.style.bottom).toBe("111px");
    expect(menu.style.maxHeight).toBe("288px");
    vi.unstubAllGlobals();
  });
});
