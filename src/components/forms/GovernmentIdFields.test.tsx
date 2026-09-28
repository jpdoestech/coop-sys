import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { GovernmentIdFields, type GovernmentIdValue } from "./GovernmentIdFields";

const emptyValue: GovernmentIdValue = {
  sss_number: null,
  pagibig_number: null,
  philhealth_number: null,
  tax_identification_number: null,
};

function TestForm() {
  const [value, setValue] = useState(emptyValue);
  return <GovernmentIdFields value={value} onChange={setValue} />;
}

describe("GovernmentIdFields", () => {
  it("accepts digits and automatically formats every government number", () => {
    render(<TestForm />);
    const sss = screen.getByLabelText("SSS number") as HTMLInputElement;
    fireEvent.change(sss, { target: { value: "12a3456789" } });
    expect(sss.value).toBe("12-345678-9");

    const pagibig = screen.getByLabelText("PAG-IBIG MID number") as HTMLInputElement;
    fireEvent.change(pagibig, { target: { value: "123456789012" } });
    expect(pagibig.value).toBe("1234-5678-9012");

    const philhealth = screen.getByLabelText("PhilHealth number") as HTMLInputElement;
    fireEvent.change(philhealth, { target: { value: "123456789012" } });
    expect(philhealth.value).toBe("12-345678901-2");

    const tin = screen.getByLabelText("TIN") as HTMLInputElement;
    fireEvent.change(tin, { target: { value: "123456789012" } });
    expect(tin.value).toBe("123-456-789-012");
  });
});
