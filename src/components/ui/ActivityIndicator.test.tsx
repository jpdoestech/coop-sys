import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityIndicator } from "./ActivityIndicator";
import { useActivityStore, withActivity } from "../../services/activity/activityStore";
describe("shared activity feedback", () => {
  afterEach(() => { vi.useRealTimers(); act(() => useActivityStore.setState({ tasks: {} })); });
  it("shows slow operations and clears the indicator on completion", () => {
    vi.useFakeTimers();
    render(<QueryClientProvider client={new QueryClient()}><ActivityIndicator /></QueryClientProvider>);
    let done!: () => void;
    act(() => { done = useActivityStore.getState().start("Importing records..."); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole("status")).toHaveTextContent("Importing records...");
    expect(screen.getByRole("status")).toHaveTextContent("Estimated");
    act(() => done());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("cleans up failed operations", async () => {
    await expect(withActivity("Saving", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(useActivityStore.getState().tasks).toEqual({});
  });
  it("shows measured progress without estimating it and clamps invalid reports", () => {
    vi.useFakeTimers();
    render(<QueryClientProvider client={new QueryClient()}><ActivityIndicator /></QueryClientProvider>);
    let task!: ReturnType<ReturnType<typeof useActivityStore.getState>["start"]>;
    act(() => { task = useActivityStore.getState().start("Importing employees..."); task.report(3, 10); });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
    expect(screen.getByRole("status")).toHaveTextContent("3 / 10 processed");
    expect(screen.getByRole("status")).not.toHaveTextContent("Estimated");
    act(() => { task.report(999, 10); });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    act(() => task());
    act(() => task.report(1, 10));
    expect(useActivityStore.getState().tasks).toEqual({});
  });
});
