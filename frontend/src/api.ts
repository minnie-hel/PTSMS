export type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type CompanyProfile = {
  name: string
  email: string
  phone: string
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

type ErrorBody = Record<string, unknown>

function errorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "The request failed."
  const body = data as ErrorBody
  if (typeof body.detail === "string") return body.detail
  if (Array.isArray(body.non_field_errors)) return body.non_field_errors.join(" ")
  const lines = Object.entries(body).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(" ") : String(value)
    return key === "non_field_errors" ? text : `${key}: ${text}`
  })
  return lines.join(" ") || "The request failed."
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
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login")
    throw new Error("Your session has ended. Sign in again.")
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) throw new Error(errorMessage(data))
  return data as T
}

export async function apiList<T>(path: string): Promise<T[]> {
  const data = await api<Page<T> | T[]>(path)
  return Array.isArray(data) ? data : data.results
}

export function emptyToNull(value: string | number | null | undefined) {
  if (value === "" || value === undefined) return null
  return value
}
