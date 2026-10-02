import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { fetchBranding, type CompanyProfile } from "./api"
import { useTheme } from "./theme"

type CompanyValue = {
  company: CompanyProfile
  loading: boolean
  refresh: () => Promise<void>
}

/** Shown when no logo or company name is stored yet (e.g. fresh install). */
export const DEFAULT_BRAND_NAME = "Paul Tours Safari"

const emptyCompany: CompanyProfile = {
  name: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  vrn_number: "",
  address: "",
  tagline: "",
  welcome_title: "",
  welcome_text: "",
  logo_url: "",
  logo_dark_url: "",
  logo_mark_url: "",
  logo_mark_dark_url: "",
  logo_wide_url: "",
  logo_wide_dark_url: "",
  primary_color: "",
  secondary_color: "",
  tin_number: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_iban: "",
  bank_swift: "",
  bank_name: "",
  bank_branch: "",
  bank_branch_code: "",
  bank_correspondent: "",
  bank_correspondent_swift: "",
  invoice_terms: "",
  invoice_footer: "",
}

const CompanyContext = createContext<CompanyValue | null>(null)

function applyBrandColors(company: CompanyProfile) {
  const root = document.documentElement
  if (company.primary_color) {
    root.style.setProperty("--brand-primary", company.primary_color)
    root.style.setProperty(
      "--brand-primary-dark",
      `color-mix(in srgb, ${company.primary_color} 78%, #000)`,
    )
  }
  if (company.secondary_color) {
    root.style.setProperty("--brand-secondary", company.secondary_color)
  }
  const title = company.name || "Safari management"
  document.title = company.tagline ? `${title} — ${company.tagline}` : title
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const data = await fetchBranding()
    setCompany(data)
    applyBrandColors(data)
  }

  useEffect(() => {
    refresh()
      .catch(() => setCompany(emptyCompany))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({ company, loading, refresh }), [company, loading])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const value = useContext(CompanyContext)
  if (!value) throw new Error("Company context is unavailable")
  return value
}

/** Both logo variants are rendered; CSS shows the one that suits the theme (and always the light one when printing). */
export function LogoImage({ className, style }: { className?: string; style?: CSSProperties }) {
  const { company } = useCompany()
  if (!company.logo_url) return null
  const alt = company.name || "Company logo"
  if (!company.logo_dark_url) return <img className={className} style={style} src={company.logo_url} alt={alt} />
  return (
    <>
      <img className={`${className || ""} logo-for-light`} style={style} src={company.logo_url} alt={alt} />
      <img className={`${className || ""} logo-for-dark`} style={style} src={company.logo_dark_url} alt={alt} />
    </>
  )
}

/** The sidebar logo: the horizontal lockup, or just the emblem when the sidebar is collapsed. */
export function SideLogo({ collapsed }: { collapsed: boolean }) {
  const { company } = useCompany()
  const { mode } = useTheme()
  const dark = mode === "dark"
  const wide = dark ? company.logo_wide_dark_url : company.logo_wide_url
  const mark = dark ? company.logo_mark_dark_url : company.logo_mark_url
  const fallback = dark ? company.logo_dark_url || company.logo_url : company.logo_url
  const src = (collapsed ? mark : wide) || fallback
  if (!src) return company.name ? <strong className="side-name">{collapsed ? company.name.slice(0, 1) : company.name}</strong> : null
  return <img className={`side-logo ${collapsed ? "is-mark" : "is-wide"}`} src={src} alt={company.name || "Company logo"} />
}

export function CompanyMark({ large, compact }: { large?: boolean; compact?: boolean }) {
  const { company } = useCompany()
  if (company.logo_url) {
    const className = large ? "brand-logo brand-logo-lg" : compact ? "brand-logo brand-logo-side" : "brand-logo"
    return <LogoImage className={className} key={company.logo_url} />
  }
  const label = company.name || DEFAULT_BRAND_NAME
  const className = large ? "brand-text brand-text-lg" : compact ? "brand-text brand-text-side" : "brand-text"
  return <strong className={className}>{label}</strong>
}

export function DocumentCompanyLine() {
  const { company } = useCompany()
  if (!company.name) return null
  return <p>{company.name}</p>
}
