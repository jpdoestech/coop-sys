import { useEffect, useMemo, useState } from "react";
import {
  barangaysForCity,
  cities,
  citiesForProvince,
  provinces,
  provincesForRegion,
  regions,
  type Barangay
} from "../../address/addressService";

export type AddressValue = {
  address: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  postal_code: string | null;
};

type AddressFieldsProps = {
  value: AddressValue;
  disabled?: boolean;
  onChange: (value: AddressValue) => void;
};

const inputClass = "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink disabled:bg-line/20 disabled:text-ink/55";

function normalizedLocationName(name: string | null) {
  return (name ?? "")
    .toLowerCase()
    .replace(/^city of\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/[^a-z0-9]/g, "");
}

export function AddressFields({ value, disabled = false, onChange }: AddressFieldsProps) {
  const initialProvince = provinces.find((item) => item.name === value.province);
  const initialCity = cities.find(
    (item) =>
      normalizedLocationName(item.name) === normalizedLocationName(value.city_municipality) &&
      (!initialProvince || item.provinceCode === initialProvince.code)
  );
  const [regionCode, setRegionCode] = useState(initialProvince?.regionCode ?? "");
  const [provinceCode, setProvinceCode] = useState(initialProvince?.code ?? "");
  const [cityCode, setCityCode] = useState(initialCity?.code ?? "");
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const provinceOptions = useMemo(() => provincesForRegion(regionCode), [regionCode]);
  const cityOptions = useMemo(() => citiesForProvince(provinceCode), [provinceCode]);

  useEffect(() => {
    const matchedProvince = provinces.find((item) => item.name === value.province);
    const matchedCity = cities.find(
      (item) =>
        normalizedLocationName(item.name) === normalizedLocationName(value.city_municipality) &&
        (!matchedProvince || item.provinceCode === matchedProvince.code)
    );
    setRegionCode(matchedProvince?.regionCode ?? "");
    setProvinceCode(matchedProvince?.code ?? "");
    setCityCode(matchedCity?.code ?? "");
  }, [value.province, value.city_municipality]);

  useEffect(() => {
    if (!cityCode) {
      setBarangays([]);
      return;
    }
    let active = true;
    barangaysForCity(cityCode).then((items) => {
      if (active) setBarangays(items.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => {
      active = false;
    };
  }, [cityCode]);

  function patch(next: Partial<AddressValue>) {
    onChange({ ...value, ...next });
  }

  return (
    <>
      <label className="block text-xs font-semibold text-ink/75 sm:col-span-2">
        Street / building
        <input className={inputClass} disabled={disabled} value={value.address ?? ""} onChange={(event) => patch({ address: event.target.value || null })} />
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Region
        <select
          className={inputClass}
          disabled={disabled}
          value={regionCode}
          onChange={(event) => {
            setRegionCode(event.target.value);
            setProvinceCode("");
            setCityCode("");
            patch({ province: null, city_municipality: null, barangay: null });
          }}
        >
          <option value="">Select region</option>
          {regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Province
        <select
          className={inputClass}
          disabled={disabled || !regionCode}
          value={provinceCode}
          onChange={(event) => {
            const selected = provinces.find((item) => item.code === event.target.value);
            setProvinceCode(event.target.value);
            setCityCode("");
            patch({ province: selected?.name ?? null, city_municipality: null, barangay: null });
          }}
        >
          <option value="">Select province</option>
          {provinceOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        City / municipality
        <select
          className={inputClass}
          disabled={disabled || !provinceCode}
          value={cityCode}
          onChange={(event) => {
            const selected = cities.find((item) => item.code === event.target.value);
            setCityCode(event.target.value);
            patch({ city_municipality: selected?.name ?? null, barangay: null });
          }}
        >
          <option value="">Select city / municipality</option>
          {cityOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Barangay
        <select className={inputClass} disabled={disabled || !cityCode} value={value.barangay ?? ""} onChange={(event) => patch({ barangay: event.target.value || null })}>
          <option value="">Select barangay</option>
          {barangays.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Postal code
        <input className={inputClass} disabled={disabled} value={value.postal_code ?? ""} onChange={(event) => patch({ postal_code: event.target.value || null })} />
      </label>
    </>
  );
}
