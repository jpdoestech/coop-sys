import { useEffect, useId, useMemo, useState } from "react";
import {
  barangaysForCity,
  cities,
  citiesForProvince,
  provinces,
  provincesForRegion,
  regions,
  type Barangay,
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

const inputClass =
  "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink disabled:bg-line/20 disabled:text-ink/55";

function normalizedLocationName(name: string | null) {
  return (name ?? "")
    .toLowerCase()
    .replace(/^city of\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/[^a-z0-9]/g, "");
}

export function AddressFields({ value, disabled = false, onChange }: AddressFieldsProps) {
  const initialProvince = provinces.find(
    (item) => normalizedLocationName(item.name) === normalizedLocationName(value.province),
  );
  const initialCity = cities.find(
    (item) =>
      normalizedLocationName(item.name) === normalizedLocationName(value.city_municipality) &&
      (!initialProvince || item.provinceCode === initialProvince.code),
  );
  const [regionCode, setRegionCode] = useState(initialProvince?.regionCode ?? "");
  const [regionName, setRegionName] = useState(
    regions.find((item) => item.code === initialProvince?.regionCode)?.name ?? "",
  );
  const [provinceCode, setProvinceCode] = useState(initialProvince?.code ?? "");
  const [cityCode, setCityCode] = useState(initialCity?.code ?? "");
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const listId = useId().replace(/:/g, "");
  const provinceOptions = useMemo(() => provincesForRegion(regionCode), [regionCode]);
  const cityOptions = useMemo(() => citiesForProvince(provinceCode), [provinceCode]);

  useEffect(() => {
    const matchedProvince = provinces.find(
      (item) => normalizedLocationName(item.name) === normalizedLocationName(value.province),
    );
    const matchedCity = cities.find(
      (item) =>
        normalizedLocationName(item.name) === normalizedLocationName(value.city_municipality) &&
        (!matchedProvince || item.provinceCode === matchedProvince.code),
    );
    const matchedRegion = regions.find((item) => item.code === matchedProvince?.regionCode);
    setRegionCode(matchedProvince?.regionCode ?? "");
    if (matchedRegion) setRegionName(matchedRegion.name);
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

  function validateInput(
    input: HTMLInputElement,
    field: string,
    valid: boolean,
    message: string,
  ) {
    input.setCustomValidity(valid ? "" : message);
    setErrors((current) => ({ ...current, [field]: valid ? "" : message }));
  }

  function changeRegion(nextName: string) {
    const match = regions.find(
      (item) => normalizedLocationName(item.name) === normalizedLocationName(nextName),
    );
    setRegionName(nextName);
    setRegionCode(match?.code ?? "");
    setProvinceCode("");
    setCityCode("");
    patch({ province: null, city_municipality: null, barangay: null });
  }

  function changeProvince(nextName: string) {
    const options = regionCode ? provinceOptions : provinces;
    const match = options.find(
      (item) => normalizedLocationName(item.name) === normalizedLocationName(nextName),
    );
    if (match && match.regionCode !== regionCode) {
      setRegionCode(match.regionCode);
      setRegionName(regions.find((item) => item.code === match.regionCode)?.name ?? "");
    }
    setProvinceCode(match?.code ?? "");
    setCityCode("");
    patch({ province: nextName || null, city_municipality: null, barangay: null });
  }

  function changeCity(nextName: string) {
    const options = provinceCode ? cityOptions : cities;
    const match = options.find(
      (item) => normalizedLocationName(item.name) === normalizedLocationName(nextName),
    );
    if (match && match.provinceCode !== provinceCode) {
      const province = provinces.find((item) => item.code === match.provinceCode);
      setProvinceCode(match.provinceCode);
      if (province) {
        setRegionCode(province.regionCode);
        setRegionName(regions.find((item) => item.code === province.regionCode)?.name ?? "");
        setCityCode(match.code);
        patch({ province: province.name, city_municipality: nextName || null, barangay: null });
        return;
      }
    }
    setCityCode(match?.code ?? "");
    patch({ city_municipality: nextName || null, barangay: null });
  }

  return (
    <>
      <label className="block text-xs font-semibold text-ink/75 sm:col-span-2">
        Street / building
        <input className={inputClass} disabled={disabled} value={value.address ?? ""} onChange={(event) => patch({ address: event.target.value || null })} />
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Region
        <input
          className={inputClass}
          disabled={disabled}
          value={regionName}
          list={`${listId}-regions`}
          placeholder="Type to search regions"
          aria-invalid={Boolean(errors.region)}
          onChange={(event) => {
            changeRegion(event.target.value);
            const valid = !event.target.value || regions.some((item) => normalizedLocationName(item.name) === normalizedLocationName(event.target.value));
            event.currentTarget.setCustomValidity(valid ? "" : "Choose a region from the official list.");
            setErrors((current) => ({ ...current, region: "" }));
          }}
          onBlur={(event) => validateInput(event.currentTarget, "region", event.currentTarget.validity.valid, "Choose a region from the official list.")}
        />
        {errors.region ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.region}</span> : null}
        <datalist id={`${listId}-regions`}>
          {regions.map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Province
        <input
          className={inputClass}
          disabled={disabled || !regionCode}
          value={value.province ?? ""}
          list={`${listId}-provinces`}
          placeholder="Type to search provinces"
          aria-invalid={Boolean(errors.province)}
          onChange={(event) => {
            changeProvince(event.target.value);
            const valid = !event.target.value || provinceOptions.some((item) => normalizedLocationName(item.name) === normalizedLocationName(event.target.value));
            event.currentTarget.setCustomValidity(valid ? "" : "Choose a province within the selected region.");
            setErrors((current) => ({ ...current, province: "" }));
          }}
          onBlur={(event) => validateInput(event.currentTarget, "province", event.currentTarget.validity.valid, "Choose a province within the selected region.")}
        />
        {errors.province ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.province}</span> : null}
        <datalist id={`${listId}-provinces`}>
          {(regionCode ? provinceOptions : provinces).map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        City / municipality
        <input
          className={inputClass}
          disabled={disabled || !provinceCode}
          value={value.city_municipality ?? ""}
          list={`${listId}-cities`}
          placeholder="Type to search cities"
          aria-invalid={Boolean(errors.city)}
          onChange={(event) => {
            changeCity(event.target.value);
            const valid = !event.target.value || cityOptions.some((item) => normalizedLocationName(item.name) === normalizedLocationName(event.target.value));
            event.currentTarget.setCustomValidity(valid ? "" : "Choose a city or municipality within the selected province.");
            setErrors((current) => ({ ...current, city: "" }));
          }}
          onBlur={(event) => validateInput(event.currentTarget, "city", event.currentTarget.validity.valid, "Choose a city or municipality within the selected province.")}
        />
        {errors.city ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.city}</span> : null}
        <datalist id={`${listId}-cities`}>
          {(provinceCode ? cityOptions : cities).map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Barangay
        <input
          className={inputClass}
          disabled={disabled || !cityCode}
          value={value.barangay ?? ""}
          list={`${listId}-barangays`}
          placeholder="Type to search barangays"
          aria-invalid={Boolean(errors.barangay)}
          onChange={(event) => {
            patch({ barangay: event.target.value || null });
            const valid = !event.target.value || barangays.some((item) => normalizedLocationName(item.name) === normalizedLocationName(event.target.value));
            event.currentTarget.setCustomValidity(valid ? "" : "Choose a barangay within the selected city or municipality.");
            setErrors((current) => ({ ...current, barangay: "" }));
          }}
          onBlur={(event) => validateInput(event.currentTarget, "barangay", event.currentTarget.validity.valid, "Choose a barangay within the selected city or municipality.")}
        />
        {errors.barangay ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.barangay}</span> : null}
        <datalist id={`${listId}-barangays`}>
          {barangays.map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Postal code
        <input className={inputClass} disabled={disabled} value={value.postal_code ?? ""} onChange={(event) => patch({ postal_code: event.target.value || null })} />
      </label>
    </>
  );
}
