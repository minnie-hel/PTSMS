import type { ListFilterField, ListStatusTab } from "./lists"
import { monthFilterOptions } from "./lists"

export const INVOICE_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
]

export const ITINERARY_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
]

export const QUOTATION_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
]

export const BOOKING_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

export const CLIENT_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

export const VENDOR_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

export const USER_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

export const monthFilterField = (label = "Any month"): ListFilterField => ({
  key: "month",
  label,
  options: monthFilterOptions(),
  clientOnly: true,
})
