import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Info, SlidersHorizontal } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ToolbarDisclosure } from "./ToolbarDisclosure";
import { SearchableSelect } from "./SearchableSelect";

function Filters() {
  const [status, setStatus] = useState("");
  return <><ToolbarDisclosure label="Record filters" icon={SlidersHorizontal} count={Number(Boolean(status))}><SearchableSelect aria-label="Record status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option><option value="active">Active</option></SearchableSelect></ToolbarDisclosure><button>Outside</button></>;
}

describe("compact toolbar disclosure", () => {
  it("opens on demand, closes with Escape and restores focus", () => {
    render(<ToolbarDisclosure label="Payment obligation" icon={Info}><p>5,500 default obligation</p></ToolbarDisclosure>);
    const button = screen.getByRole("button", { name: "Payment obligation" });
    expect(screen.queryByText("5,500 default obligation")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("5,500 default obligation")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
  it("allows selections inside portalled dropdowns and keeps the filter panel open", () => {
    render(<Filters />);
    fireEvent.click(screen.getByRole("button", { name: "Record filters" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Record status" }));
    const option = screen.getByRole("option", { name: "Active" });
    fireEvent.pointerDown(option); fireEvent.click(option);
    expect(screen.getByRole("combobox", { name: "Record status" })).toHaveTextContent("Active");
    expect(screen.getByRole("button", { name: "Record filters" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("active filters")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByRole("button", { name: "Record filters" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Record filters" }));
    expect(screen.getByRole("combobox", { name: "Record status" })).toHaveTextContent("Active");
  });
  it("keeps disabled disclosures closed", () => {
    render(<ToolbarDisclosure label="Busy filters" icon={SlidersHorizontal} disabled><p>Options</p></ToolbarDisclosure>);
    fireEvent.click(screen.getByRole("button", { name: "Busy filters" }));
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });
});
