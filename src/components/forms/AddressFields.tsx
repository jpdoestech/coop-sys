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
        <input className={inputClass} disabled={disabled} value={regionName} list={`${listId}-regions`} placeholder="Select or type a region" onChange={(event) => changeRegion(event.target.value)} />
        <datalist id={`${listId}-regions`}>
          {regions.map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Province
        <input className={inputClass} disabled={disabled} value={value.province ?? ""} list={`${listId}-provinces`} placeholder="Select or type a province" onChange={(event) => changeProvince(event.target.value)} />
        <datalist id={`${listId}-provinces`}>
          {(regionCode ? provinceOptions : provinces).map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        City / municipality
        <input className={inputClass} disabled={disabled} value={value.city_municipality ?? ""} list={`${listId}-cities`} placeholder="Select or type a city / municipality" onChange={(event) => changeCity(event.target.value)} />
        <datalist id={`${listId}-cities`}>
          {(provinceCode ? cityOptions : cities).map((item) => <option key={item.code} value={item.name} />)}
        </datalist>
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        Barangay
        <input className={inputClass} disabled={disabled} value={value.barangay ?? ""} list={`${listId}-barangays`} placeholder="Select or type a barangay" onChange={(event) => patch({ barangay: event.target.value || null })} />
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
