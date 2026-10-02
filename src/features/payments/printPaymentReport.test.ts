import { afterEach, describe, expect, it, vi } from "vitest";
import { openPrintReport, openPrintWindow } from "./printPaymentReport";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openPrintReport", () => {
  it("opens a full report and prints from its toolbar", () => {
    const popupDocument = document.implementation.createHTMLDocument("");
    const print = vi.fn();
    const popup = {
      document: popupDocument,
      focus: vi.fn(),
      opener: window,
      print,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPrintReport({
      title: "Payment Summary",
      subtitle: "All accessible employees",
      meta: ["Year: 2026", "Records: 1"],
      columns: [{ label: "Employee" }, { label: "Total", align: "right" }],
      rows: [["000001 - Santos, Amara", "PHP 5,500.00"]],
    });

    expect(popupDocument.title).toBe("Payment Summary");
    expect(popupDocument.body.textContent).toContain("000001 - Santos, Amara");
    expect(popupDocument.querySelector("td.right")?.textContent).toBe(
      "PHP 5,500.00",
    );
    (popupDocument.querySelector(".print-button") as HTMLButtonElement).click();
    expect(print).toHaveBeenCalledOnce();
  });

  it("reports when the browser blocks the new tab", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(() =>
      openPrintReport({ title: "Payment History", columns: [], rows: [] }),
    ).toThrow("Allow pop-ups to open the print view.");
  });

  it("can reserve the print tab before asynchronous report loading", () => {
    const popupDocument = document.implementation.createHTMLDocument("");
    const popup = {
      document: popupDocument,
      focus: vi.fn(),
      opener: window,
      print: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    const reserved = openPrintWindow("Preparing Payment Summary");
    expect(reserved).toBe(popup);
    expect(popupDocument.body.textContent).toBe("Preparing report...");
  });

  it("applies the selected page orientation", () => {
    const popupDocument = document.implementation.createHTMLDocument("");
    const popup = { document: popupDocument, focus: vi.fn(), opener: window, print: vi.fn() } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPrintReport({ title: "Employee Payment History", orientation: "portrait", columns: [], rows: [] });

    expect(popupDocument.querySelector("style")?.textContent).toContain("@page { size: portrait;");
  });
});
