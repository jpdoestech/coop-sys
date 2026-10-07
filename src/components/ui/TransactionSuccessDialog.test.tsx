import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionSuccessDialog } from "./TransactionSuccessDialog";
import { showTransactionSuccess, useTransactionNotifications } from "../../services/activity/transactionNotifications";

beforeEach(() => Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } }));
afterEach(() => { while (useTransactionNotifications.getState().notices.length) useTransactionNotifications.getState().dismiss(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); });
describe("bulk transaction success", () => {
  it("waits for acknowledgement before permitting the original form to close", async () => {
    render(<TransactionSuccessDialog />);
    const close = vi.fn();
    let result!: Promise<void>;
    act(() => { result = showTransactionSuccess("Import completed", "12 employees imported.").then(close); });
    expect(screen.getByRole("dialog")).toHaveTextContent("12 employees imported.");
    expect(close).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done" })); await result; });
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("queues notices and acknowledges them separately", async () => {
    render(<TransactionSuccessDialog />);
    let first!: Promise<void>, second!: Promise<void>;
    const complete = vi.fn();
    act(() => { first = showTransactionSuccess("First batch", "5 saved"); second = showTransactionSuccess("Second batch", "6 saved").then(complete); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done" })); await first; });
    expect(screen.getByRole("dialog")).toHaveTextContent("Second batch");
    expect(complete).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done" })); await second; });
    expect(complete).toHaveBeenCalledOnce();
  });
});
