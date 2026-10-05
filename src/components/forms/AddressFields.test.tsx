import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.unstubAllGlobals());
  it("allows typed search but rejects locations outside the official hierarchy", () => {
    render(<AddressHarness />);

    const region = screen.getByLabelText("Region");
    const province = screen.getByLabelText("Province");
    const city = screen.getByLabelText("City / municipality");
    const barangay = screen.getByLabelText("Barangay");

    expect(region).toHaveAttribute("role", "combobox");
    expect(province).toBeEnabled();
    expect(city).toBeEnabled();
    expect(barangay).toBeEnabled();

    fireEvent.change(region, { target: { value: "Custom Region" } });
    fireEvent.blur(region);

    expect(region).toBeInvalid();
    expect(screen.getByText("Choose a region from the official list.")).toBeInTheDocument();
  });

  it("searches barangays without parents and fills the official city and province", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { code: "1130700002", name: "Agdao", cityCode: "1130700000" },
      { code: "0105524002", name: "Agdao", cityCode: "0105524000" },
    ] }));
    render(<AddressHarness />);
    fireEvent.change(screen.getByLabelText("Barangay"), { target: { value: "Agd" } });
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("City of Davao, Davao del Sur");
    fireEvent.click(options[0]);
    await waitFor(() => expect(screen.getByLabelText("Province")).toHaveValue("Davao del Sur"));
    expect(screen.getByLabelText("City / municipality")).toHaveValue("City of Davao");
    expect(screen.getByLabelText("Barangay")).toHaveValue("Agdao");
  });

  it("rejects unfinished province text even after its draft value updates", () => {
    render(<AddressHarness />);
    const province = screen.getByLabelText("Province");
    fireEvent.change(province, { target: { value: "Invalid province" } });
    fireEvent.blur(province);
    expect(province).toBeInvalid();
    expect(screen.getByText("Choose a province from the official list.")).toBeInTheDocument();
  });
});

