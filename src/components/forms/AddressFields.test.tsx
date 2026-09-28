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
  it("accepts custom geographic values without requiring a lookup selection", () => {
    render(<AddressHarness />);

    const region = screen.getByLabelText("Region");
    const province = screen.getByLabelText("Province");
    const city = screen.getByLabelText("City / municipality");
    const barangay = screen.getByLabelText("Barangay");

    expect(region).toHaveAttribute("list");
    expect(province).toBeEnabled();
    expect(city).toBeEnabled();
    expect(barangay).toBeEnabled();

    fireEvent.change(region, { target: { value: "Custom Region" } });
    fireEvent.change(province, { target: { value: "Custom Province" } });
    fireEvent.change(city, { target: { value: "Custom Municipality" } });
    fireEvent.change(barangay, { target: { value: "Custom Barangay" } });

    expect(region).toHaveValue("Custom Region");
    expect(province).toHaveValue("Custom Province");
    expect(city).toHaveValue("Custom Municipality");
    expect(barangay).toHaveValue("Custom Barangay");
  });
});

