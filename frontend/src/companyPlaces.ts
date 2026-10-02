/** Country and city lists for company settings; selecting an option can autofill related fields. */

export type CountryOption = {
  code: string
  label: string
  phonePrefix: string
}

export type CityOption = {
  name: string
  addressLine: string
}

export const COMPANY_COUNTRIES: CountryOption[] = [
  { code: "TZ", label: "Tanzania", phonePrefix: "+255" },
  { code: "KE", label: "Kenya", phonePrefix: "+254" },
  { code: "UG", label: "Uganda", phonePrefix: "+256" },
  { code: "RW", label: "Rwanda", phonePrefix: "+250" },
  { code: "ZA", label: "South Africa", phonePrefix: "+27" },
  { code: "US", label: "United States", phonePrefix: "+1" },
  { code: "GB", label: "United Kingdom", phonePrefix: "+44" },
]

export const COMPANY_CITIES: Record<string, CityOption[]> = {
  TZ: [
    { name: "Dar es Salaam", addressLine: "Dar es Salaam" },
    { name: "Arusha", addressLine: "Arusha" },
    { name: "Moshi", addressLine: "Moshi" },
    { name: "Zanzibar", addressLine: "Zanzibar" },
    { name: "Mwanza", addressLine: "Mwanza" },
    { name: "Dodoma", addressLine: "Dodoma" },
  ],
  KE: [
    { name: "Nairobi", addressLine: "Nairobi" },
    { name: "Mombasa", addressLine: "Mombasa" },
  ],
  UG: [{ name: "Kampala", addressLine: "Kampala" }],
  RW: [{ name: "Kigali", addressLine: "Kigali" }],
}

export function countryByCode(code: string) {
  return COMPANY_COUNTRIES.find((item) => item.code === code)
}

export function autofillFromCountry(code: string, current: { phone?: string; city?: string }) {
  const country = countryByCode(code)
  const patch: { phone?: string; city?: string } = {}
  if (country && !current.phone?.trim()) patch.phone = country.phonePrefix
  const cities = COMPANY_CITIES[code] || []
  if (cities.length === 1 && !current.city?.trim()) patch.city = cities[0].name
  return patch
}

export function autofillFromCity(countryCode: string, cityName: string, current: { address?: string }) {
  const city = (COMPANY_CITIES[countryCode] || []).find((item) => item.name === cityName)
  if (!city || current.address?.trim()) return {}
  return { address: city.addressLine }
}
