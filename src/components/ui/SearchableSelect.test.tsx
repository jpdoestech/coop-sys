import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";

describe("searchable dropdown", () => {
  it("searches suggestions and emits the original select change event", () => {
    function Field() { const [value, setValue] = useState(""); return <SearchableSelect aria-label="Department" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Not set</option><option value="finance">Finance</option><option value="hr">Human resources</option></SearchableSelect>; }
    render(<Field />);
    fireEvent.click(screen.getByRole("combobox", { name: "Department" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "fin" } });
    expect(screen.queryByRole("option", { name: "Human resources" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Finance" }));
    expect(screen.getByRole("combobox", { name: "Department" })).toHaveTextContent("Finance");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
  it("accepts custom text only when the field allows it", () => {
    const custom = vi.fn();
    render(<SearchableSelect aria-label="Department" onCustomValue={custom}><option value="">Not set</option></SearchableSelect>);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "New division" } });
    fireEvent.click(screen.getByRole("button", { name: 'Use "New division"' }));
    expect(custom).toHaveBeenCalledWith("New division");
  });
});
