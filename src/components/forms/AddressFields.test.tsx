import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AddressFields, type AddressValue } from "./AddressFields";

const emptyAddress: AddressValue = {
  address: null,
  barangay: null,
  city_municipality: null,
  province: null,
  postal_code: null,
};

function AddressHarness() {
  const [value, setValue] = useState(emptyAddress);
  return <AddressFields value={value} onChange={setValue} />;
}

describe("AddressFields", () => {
  it("allows typed search but rejects locations outside the official hierarchy", () => {
    render(<AddressHarness />);

    const region = screen.getByLabelText("Region");
    const province = screen.getByLabelText("Province");
    const city = screen.getByLabelText("City / municipality");
    const barangay = screen.getByLabelText("Barangay");

    expect(region).toHaveAttribute("list");
    expect(province).toBeDisabled();
    expect(city).toBeDisabled();
    expect(barangay).toBeDisabled();

    fireEvent.change(region, { target: { value: "Custom Region" } });
    fireEvent.blur(region);

    expect(region).toBeInvalid();
    expect(screen.getByText("Choose a region from the official list.")).toBeInTheDocument();
  });
});

