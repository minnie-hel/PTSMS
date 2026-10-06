import { emitAppError, FALLBACK_ERROR, messageFromResponse } from "./errors"

export type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type CompanyBankAccount = {
  id?: number
  currency: number | null
  currency_code?: string
  account_name: string
  account_number: string
  iban: string
  swift: string
  bank_name: string
  branch: string
  branch_code: string
  correspondent: string
  correspondent_swift: string
}

export type CompanyProfile = {
  name: string
  email: string
  phone: string
  city: string
  country: string
  vrn_number: string
  address: string
  tagline: string
  welcome_title: string
  welcome_text: string
  logo_url: string
  logo_dark_url: string
  logo_mark_url: string
  logo_mark_dark_url: string
  logo_wide_url: string
  logo_wide_dark_url: string
  primary_color: string
  secondary_color: string
  tin_number: string
  bank_account_name: string
  bank_account_number: string
  bank_iban: string
  bank_swift: string
  bank_name: string
  bank_branch: string
  bank_branch_code: string
  bank_correspondent: string
  bank_correspondent_swift: string
  banks?: CompanyBankAccount[]
  invoice_terms: string
  invoice_footer: string
}

export async function fetchBranding(): Promise<CompanyProfile> {
  const response = await fetch("/api/branding/")
  if (!response.ok) throw new Error("Could not load company branding.")
  return (await response.json()) as CompanyProfile
}

export type SessionUser = {
  id: number
  email: string
  full_name: string
  phone: string
  role: number | null
  role_name: string | null
  is_superadmin: boolean
  is_active: boolean
  permissions: string[]
}

async function refreshAccess(): Promise<boolean> {
  const refresh = localStorage.getItem("ptsms_refresh")
  if (!refresh) return false
  const response = await fetch("/api/auth/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
  if (!response.ok) return false
  const data = (await response.json()) as { access: string }
  localStorage.setItem("ptsms_access", data.access)
  return true
}

export function clearSession() {
  localStorage.removeItem("ptsms_access")
  localStorage.removeItem("ptsms_refresh")
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const access = localStorage.getItem("ptsms_access")
  if (access) headers.set("Authorization", `Bearer ${access}`)
  const response = await fetch(path, { ...options, headers })
  if (response.status === 401 && retry && !path.includes("/auth/token")) {
    const refreshed = await refreshAccess()
    if (refreshed) return api<T>(path, options, false)
    clearSession()
    const ended = "Your session has ended. Sign in again."
    emitAppError(ended)
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login")
    throw new Error(ended)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      const message = response.ok
        ? "The server returned an unexpected response."
        : FALLBACK_ERROR
      if (!response.ok) emitAppError(message)
      throw new Error(message)
    }
  }
  if (!response.ok) {
    const message = messageFromResponse(data, response.status)
    emitAppError(message)
    throw new Error(message)
  }
  return data as T
}

function withPageSize(path: string, size = 500): string {
  if (path.includes("page_size=")) return path
  return `${path}${path.includes("?") ? "&" : "?"}page_size=${size}`
}

/** Loads every row from a paginated list endpoint (dropdowns and small catalogs). */
export async function apiList<T>(path: string): Promise<T[]> {
  let nextPath: string | null = withPageSize(path)
  const rows: T[] = []
  while (nextPath) {
    const page: Page<T> | T[] = await api<Page<T> | T[]>(nextPath)
    if (Array.isArray(page)) {
      rows.push(...page)
      break
    }
    rows.push(...page.results)
    if (!page.next) break
    nextPath = page.next.replace(/^https?:\/\/[^/]+/, "") || null
  }
  return rows
}

export function emptyToNull(value: string | number | null | undefined) {
  if (value === "" || value === undefined) return null
  return value
}
