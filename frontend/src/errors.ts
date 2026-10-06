export const FALLBACK_ERROR = "Something went wrong. Please try again."

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  detail: "",
  non_field_errors: "",
  banks: "Bank details",
  stays: "Hotel stay",
  travellers: "Traveller",
  agreed_cost: "Hotel cost",
  cost_currency: "Cost currency",
  total_amount: "Amount",
  check_in: "Check-in",
  check_out: "Check-out",
  invoice: "Invoice",
  booking: "Booking",
  vendor: "Vendor",
  accommodation: "Stay",
  amount: "Amount",
  paid_on: "Payment date",
  hotel: "Lodge",
  client: "Client",
  lead: "Lead",
  currency: "Currency",
  start_date: "Start date",
  end_date: "End date",
  bank_name: "Bank name",
  bank_account_name: "Account name",
  bank_account_number: "Account number",
}

function isTechnicalMessage(text: string) {
  const value = text.trim()
  if (!value) return true
  if (value.length > 280) return true
  return /traceback|integrityerror|operationalerror|programmingerror|syntaxerror|typeerror|referenceerror|at 0x|<\/?[a-z!]|file "|line \d+|django\.|psycopg|gunicorn|modulenotfound|jsondecode|expecting value|failed to compile|webpack|vite precache|npm err/i.test(
    value,
  )
}

export function sanitizeUserMessage(text: string, fallback = FALLBACK_ERROR) {
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned || isTechnicalMessage(cleaned)) return fallback
  return cleaned
}

function labelFor(key: string) {
  if (key in FIELD_LABELS) return FIELD_LABELS[key]
  if (/^\d+$/.test(key)) return ""
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return ""
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function flattenErrors(value: unknown, key = ""): string[] {
  if (value == null || value === "") return []
  if (typeof value === "string") {
    const text = sanitizeUserMessage(value, "")
    if (!text) return []
    const label = labelFor(key)
    if (label && !text.toLowerCase().includes(label.toLowerCase())) return [`${label}: ${text}`]
    return [text]
  }
  if (typeof value === "number" || typeof value === "boolean") return []
  if (Array.isArray(value)) return value.flatMap((item) => flattenErrors(item, key))
  if (typeof value === "object") {
    const body = value as Record<string, unknown>
    if (typeof body.detail === "string") return flattenErrors(body.detail, "")
    return Object.entries(body).flatMap(([name, item]) => flattenErrors(item, name))
  }
  return []
}

export function messageFromResponse(data: unknown, status: number) {
  const lines = flattenErrors(data)
  if (lines.length) return lines.slice(0, 3).join(" ")
  if (status === 401) return "Your session has ended. Sign in again."
  if (status === 403) return "You do not have permission to do that."
  if (status === 404) return "That record was not found."
  if (status >= 500) return "The server could not complete that request. Please try again."
  return FALLBACK_ERROR
}

export function messageFromError(err: unknown, fallback = FALLBACK_ERROR) {
  if (err instanceof Error && err.message) return sanitizeUserMessage(err.message, fallback)
  return fallback
}

export function emitAppError(message: string) {
  const text = sanitizeUserMessage(message)
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("ptsms:error", { detail: text }))
}
