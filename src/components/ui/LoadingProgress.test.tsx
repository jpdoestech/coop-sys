import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingProgress } from "./LoadingProgress";

afterEach(() => vi.useRealTimers());
describe("LoadingProgress", () => {
  it("labels estimates and never claims completion before the request finishes", () => {
    vi.useFakeTimers();
    render(<LoadingProgress label="Loading records..." />);
    act(() => vi.advanceTimersByTime(120000));
    expect(screen.getByRole("status")).toHaveTextContent("Estimated 90%");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("shows measured percentages and accessible row counts", () => {
    render(<LoadingProgress label="Importing..." percentage={50} completed={20} total={40} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("status")).toHaveTextContent("20 / 40 processed");
  });
});
