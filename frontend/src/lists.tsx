import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"

function listDeleteUrl(path: string, id: number | string) {
  const base = path.split("?")[0]
  const root = base.endsWith("/") ? base : `${base}/`
  return `${root}${id}/`
}
import { Link } from "react-router-dom"
import { api, apiList } from "./api"
import { Field, Modal } from "./ui"
import type { ExportFormat } from "./export"
import { IconEdit, IconEye, IconFilter, IconPlus, IconTrash } from "./icons"
import { useToast } from "./toast"

/** Delays a fast-changing value (a search box) so the list is not reloaded on every keystroke. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Loads a list endpoint with a debounced search and any filters, and reloads on demand. */
export function useList<T>(path: string, search: string, filters: Record<string, string> = {}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const term = useDebounced(search)
  const key = JSON.stringify(filters)

  function load() {
    const query = new URLSearchParams({ page_size: "200" })
    if (term.trim()) query.set("search", term.trim())
    for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value)
    setLoading(true)
    apiList<T>(`${path}?${query.toString()}`)
      .then((data) => { setRows(data); setError("") })
      .catch(() => { setRows([]); setError("") })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    if (!path) {
      setRows([])
      setLoading(false)
      return
    }
    load()
  }, [path, term, key])

  async function remove(id: number | string) {
    try {
      await api(listDeleteUrl(path, id), { method: "DELETE" })
      setError("")
      load()
    } catch (err) {
      throw err
    }
  }
  return { rows, loading, error, setError, load, remove }
}

export type ListStatusTab = { value: string; label: string }

export type ListFilterField = {
  key: string
  label: string
  options: { value: string | number; label: string }[]
  /** Applied on the client (e.g. month on invoice_date). */
  clientOnly?: boolean
}

export function monthFilterOptions(monthsBack = 14) {
  const items: { value: string; label: string }[] = [{ value: "", label: "Any month" }]
  const now = new Date()
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    items.push({ value, label })
  }
  return items
}

function listPathBase(path: string) {
  const [base] = path.split("?")
  return base.endsWith("/") ? base : `${base}/`
}

/** List data with status tabs, dropdown filters (no text search), and client pagination. */
export function useListScreen<T extends Record<string, unknown>>(
  path: string,
  options: {
    statusKey?: string
    statusTabs?: ListStatusTab[]
    filterFields?: ListFilterField[]
    pageSize?: number
    dateKey?: string
    /** Resets tabs/filters when the route or submodule changes (e.g. /bookings vs /bookings/upcoming). */
    screenKey?: string
    initialStatusTab?: string
    initialFilters?: Record<string, string>
  } = {},
) {
  const statusKey = options.statusKey ?? "status"
  const pageSize = options.pageSize ?? 20
  const dateKey = options.dateKey ?? "created_at"
  const screenKey = options.screenKey ?? ""
  const initialFiltersKey = JSON.stringify(options.initialFilters ?? {})
  const [statusTab, setStatusTabState] = useState(options.initialStatusTab ?? "")
  const [filters, setFiltersState] = useState<Record<string, string>>(options.initialFilters ?? {})
  const [page, setPage] = useState(0)
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({ "": 0 })

  useEffect(() => {
    setStatusTabState(options.initialStatusTab ?? "")
    setFiltersState(options.initialFilters ?? {})
    setPage(0)
  }, [screenKey, options.initialStatusTab, initialFiltersKey])

  const setStatusTab = useCallback((value: string) => {
    setStatusTabState(value)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFiltersState((current) => ({ ...current, [key]: value }))
  }, [])

  const serverFilters = useMemo(() => {
    const out: Record<string, string> = {}
    if (statusTab) out[statusKey] = statusTab
    for (const field of options.filterFields ?? []) {
      if (!field.clientOnly && filters[field.key]) out[field.key] = filters[field.key]
    }
    return out
  }, [statusTab, statusKey, filters, JSON.stringify(options.filterFields ?? [])])

  const { rows: fetched, loading, error, setError, load, remove } = useList<T>(path, "", serverFilters)

  useEffect(() => {
    if (!path) return
    const query = new URLSearchParams({ page_size: "500" })
    apiList<T>(`${listPathBase(path)}?${query.toString()}`)
      .then((data) => {
        const counts: Record<string, number> = { "": data.length }
        for (const tab of options.statusTabs ?? []) {
          if (tab.value) counts[tab.value] = 0
        }
        for (const row of data) {
          const raw = row[statusKey]
          const s = typeof raw === "boolean" ? String(raw) : String(raw ?? "")
          counts[s] = (counts[s] || 0) + 1
        }
        setTabCounts(counts)
      })
      .catch(() => setTabCounts({ "": 0 }))
  }, [path, statusKey, options.statusTabs])

  const filtered = useMemo(() => {
    let list = fetched
    const month = filters.month
    if (month) {
      list = list.filter((row) => String(row[dateKey] ?? row.invoice_date ?? row.travel_date ?? "").startsWith(month))
    }
    for (const field of options.filterFields ?? []) {
      if (!field.clientOnly || field.key === "month") continue
      const val = filters[field.key]
      if (val) list = list.filter((row) => String(row[field.key] ?? "") === val)
    }
    return list
  }, [fetched, filters, options.filterFields, dateKey])

  useEffect(() => {
    setPage(0)
  }, [statusTab, filters])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return {
    rows,
    allRows: filtered,
    fetchedRows: fetched,
    loading,
    error,
    setError,
    load,
    remove,
    statusTab,
    setStatusTab,
    filters,
    setFilter,
    page: safePage,
    setPage,
    pageSize,
    total,
    tabCounts,
  }
}

export function useClientPagination<T>(rows: T[], pageSize = 20) {
  const [page, setPage] = useState(0)
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(page, pageCount - 1)
  useEffect(() => {
    setPage(0)
  }, [total])
  const slice = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)
  return { rows: slice, page: safePage, setPage, pageSize, total }
}

export function ModuleStatusTabs({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: ListStatusTab[]
  active: string
  onChange: (value: string) => void
  counts?: Record<string, number>
}) {
  const allTab = tabs.find((tab) => tab.value === "") ?? { value: "", label: "All" }
  const rest = tabs.filter((tab) => tab.value !== "")
  const ordered = [allTab, ...rest]
  return (
    <div className="module-status-tabs no-print" role="tablist">
      {ordered.map((tab) => {
        const count = counts?.[tab.value] ?? (tab.value === "" ? counts?.[""] : counts?.[tab.value])
        const label = count !== undefined && count !== null ? `${tab.label}(${count})` : tab.label
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={active === tab.value}
            className={`module-status-tab ${active === tab.value ? "active" : ""}`}
            onClick={() => onChange(tab.value)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** Toolbar row: pagination, filter dropdowns panel, export, add new. */
export function ListToolbar({
  statusTabs,
  activeStatusTab = "",
  onStatusTabChange,
  tabCounts,
  page = 0,
  pageSize = 20,
  total = 0,
  onPageChange,
  filterFields,
  filterValues = {},
  onFilterChange,
  createLabel,
  onCreate,
  createTo,
  onExport,
}: {
  statusTabs?: ListStatusTab[]
  activeStatusTab?: string
  onStatusTabChange?: (value: string) => void
  tabCounts?: Record<string, number>
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  filterFields?: ListFilterField[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  createLabel?: string
  onCreate?: () => void
  createTo?: string
  onExport?: (format: ExportFormat) => void
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const start = total === 0 ? 0 : page * pageSize + 1
  const end = Math.min(total, (page + 1) * pageSize)
  const canPrev = page > 0
  const canNext = end < total

  return (
    <div className="list-screen no-print">
      {statusTabs?.length && onStatusTabChange ? (
        <ModuleStatusTabs tabs={statusTabs} active={activeStatusTab} onChange={onStatusTabChange} counts={tabCounts} />
      ) : null}
      <div className="list-toolbar">
        <div className="list-toolbar-start">
          <div className="list-pagination">
            <button type="button" className="ghost" disabled={!canPrev} onClick={() => onPageChange?.(page - 1)}>Prev</button>
            <span className="list-pagination-meta">{total ? `${start}–${end} of ${total}` : "0 of 0"}</span>
            <button type="button" className="ghost" disabled={!canNext} onClick={() => onPageChange?.(page + 1)}>Next</button>
          </div>
        </div>
        <div className="list-toolbar-end">
          {filterFields?.length && onFilterChange ? (
            <div className="list-filter-menu">
              <button type="button" className={`button icon-btn-text ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}>
                <IconFilter /> Filter
              </button>
              {filtersOpen ? (
                <div className="list-filter-panel">
                  {filterFields.map((field) => (
                    <FilterSelect
                      key={field.key}
                      value={filterValues[field.key] ?? ""}
                      onChange={(value) => onFilterChange(field.key, value)}
                      label={field.label}
                      options={field.options}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {onExport ? (
            <div className="export-menu">
              <button type="button" className="button" onClick={() => setExportOpen((open) => !open)}>Export</button>
              {exportOpen ? (
                <div className="export-panel">
                  {(["pdf", "xlsx", "csv", "json"] as ExportFormat[]).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => {
                        setExportOpen(false)
                        onExport(format)
                      }}
                    >
                      {format === "pdf" ? "PDF (print)" : format === "xlsx" ? "Excel" : format.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {createLabel && createTo ? (
            <Link className="button primary" to={createTo}><IconPlus /> {createLabel}</Link>
          ) : null}
          {createLabel && onCreate ? (
            <button type="button" className="primary" onClick={onCreate}><IconPlus /> {createLabel}</button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: { value: string | number; label: string }[]
}) {
  return (
    <select className="list-filter-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

type ActionProps = {
  onView?: () => void
  viewTo?: string
  onEdit?: () => void
  editTo?: string
  /** Called after the user confirms. Throw to keep the dialog open and show the message. */
  onDelete?: () => void | Promise<void>
  deleteName?: string
}

/** The view, edit and delete icons at the end of a table row. Leave a prop out to hide that action. */
export function RowActions({ onView, viewTo, onEdit, editTo, onDelete, deleteName }: ActionProps) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
      toast.success("Deleted successfully")
      setConfirming(false)
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row-actions no-print" onClick={(event) => event.stopPropagation()}>
      {viewTo ? <Link className="icon-btn" to={viewTo} title="View" aria-label="View"><IconEye /></Link> : null}
      {onView && !viewTo ? <button type="button" className="icon-btn" onClick={onView} title="View" aria-label="View"><IconEye /></button> : null}
      {editTo ? <Link className="icon-btn" to={editTo} title="Edit" aria-label="Edit"><IconEdit /></Link> : null}
      {onEdit && !editTo ? <button type="button" className="icon-btn" onClick={onEdit} title="Edit" aria-label="Edit"><IconEdit /></button> : null}
      {onDelete ? (
        <button type="button" className="icon-btn danger" onClick={() => setConfirming(true)} title="Delete" aria-label="Delete">
          <IconTrash />
        </button>
      ) : null}
      {confirming ? (
        <Modal title="Delete this record?" onClose={() => setConfirming(false)}>
          <div className="stack">
            <p>{deleteName ? <><strong>{deleteName}</strong> will be removed.</> : "This record will be removed."} This cannot be undone.</p>
            <div className="row">
              <button type="button" className="danger-btn" disabled={busy} onClick={confirm}>{busy ? "Deleting…" : "Delete"}</button>
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

/** A read-only card with every detail of one record, opened by the eye icon. */
export function DetailModal({
  title,
  items,
  onClose,
  onEdit,
}: {
  title: string
  items: [string, ReactNode][]
  onClose: () => void
  onEdit?: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <dl className="detail-list">
        {items.map(([label, value]) => (
          <div key={label} className="detail-row">
            <dt>{label}</dt>
            <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
      {onEdit ? (
        <div className="row" style={{ marginTop: 14 }}>
          <button type="button" className="primary" onClick={onEdit}><IconEdit /> Edit</button>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 14 }}>
          <button type="button" className="ghost" onClick={onClose}>Back</button>
        </div>
      )}
    </Modal>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="empty-cell">{children}</td></tr>
}

export function ListPrimary({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <>
      {typeof title === "string" ? <strong>{title}</strong> : title}
      {meta ? <div className="muted list-meta">{meta}</div> : null}
    </>
  )
}

export function truncateText(text: string, max = 72) {
  const clean = text.trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

export type FieldDef = {
  name: string
  label: string
  type?: "text" | "email" | "password" | "number" | "date" | "textarea" | "select" | "checkbox"
  options?: { value: string | number; label: string }[]
  placeholder?: string
  required?: boolean
  wide?: boolean
  empty?: string
}

/** A modal form built from a field list, used by the simple create/edit screens. */
export function RecordForm({
  title,
  formKey,
  fields,
  initial,
  submitLabel = "Save",
  successMessage,
  note,
  onSubmit,
  onClose,
}: {
  title: string
  /** Changes when switching create vs edit so fields repopulate from `initial`. */
  formKey?: string
  fields: FieldDef[]
  initial?: Record<string, string | number | boolean | null | undefined>
  submitLabel?: string
  successMessage?: string
  note?: ReactNode
  onSubmit: (values: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const toast = useToast()
  function valuesFromInitial() {
    return Object.fromEntries(
      fields.map((field) => {
        const raw = initial?.[field.name]
        const value = field.type === "checkbox" ? (raw === false ? "" : "1") : raw === null || raw === undefined ? "" : String(raw)
        return [field.name, value]
      }),
    )
  }
  const [values, setValues] = useState<Record<string, string>>(valuesFromInitial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setValues(valuesFromInitial())
  }, [title, formKey])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSubmit(values)
      toast.success(successMessage ?? "Saved successfully")
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {note ? <div className="wide muted">{note}</div> : null}
        {fields.map((field) => {
          const value = values[field.name] ?? ""
          const set = (next: string) => setValues((current) => ({ ...current, [field.name]: next }))
          if (field.type === "checkbox") {
            return (
              <label key={field.name} className="check-field wide">
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => set(event.target.checked ? "1" : "")} />
                {field.label}
              </label>
            )
          }
          return (
            <Field key={field.name} label={field.label} wide={field.wide || field.type === "textarea"}>
              {field.type === "textarea" ? (
                <textarea value={value} onChange={(event) => set(event.target.value)} required={field.required} placeholder={field.placeholder} />
              ) : field.type === "select" ? (
                <>
                  <select
                    className="select-full"
                    value={value}
                    onChange={(event) => set(event.target.value)}
                    required={field.required}
                    disabled={!field.options?.length && field.required}
                  >
                    <option value="">{field.empty || "Choose"}</option>
                    {field.options?.map((option) => (
                      <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
                    ))}
                  </select>
                  {!field.options?.length && field.required ? (
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Nothing to choose yet. Create an invoice from the booking workflow, then return here.</p>
                  ) : null}
                </>
              ) : (
                <input
                  type={field.type || "text"}
                  value={value}
                  onChange={(event) => set(event.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  step={field.type === "number" ? "any" : undefined}
                />
              )}
            </Field>
          )
        })}
        <div className="form-footer wide">
          <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
