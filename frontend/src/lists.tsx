import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { api, apiList } from "./api"
import { Banner, Field, Modal } from "./ui"
import { IconEdit, IconEye, IconPlus, IconSearch, IconTrash } from "./icons"

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
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [path, term, key])

  async function remove(id: number | string) {
    await api(`${path}${id}/`, { method: "DELETE" })
    load()
  }
  return { rows, loading, error, setError, load, remove }
}

/** Search box, filters, and the blue create button that sit above every list. */
export function ListToolbar({
  search,
  onSearch,
  placeholder = "Search",
  filters,
  createLabel,
  onCreate,
  createTo,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder?: string
  filters?: ReactNode
  createLabel?: string
  onCreate?: () => void
  createTo?: string
}) {
  return (
    <div className="list-toolbar no-print">
      <label className="search-box">
        <IconSearch />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
      </label>
      {filters ? <div className="list-filters">{filters}</div> : null}
      <div className="list-toolbar-end">
        {createLabel && createTo ? (
          <Link className="button primary" to={createTo}><IconPlus /> {createLabel}</Link>
        ) : null}
        {createLabel && onCreate ? (
          <button type="button" className="primary" onClick={onCreate}><IconPlus /> {createLabel}</button>
        ) : null}
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
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
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
  onDelete?: () => Promise<void>
  deleteName?: string
}

/** The view, edit and delete icons at the end of a table row. Leave a prop out to hide that action. */
export function RowActions({ onView, viewTo, onEdit, editTo, onDelete, deleteName }: ActionProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function confirm() {
    if (!onDelete) return
    setBusy(true)
    setError("")
    try {
      await onDelete()
      setConfirming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete")
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
            <Banner>{error}</Banner>
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
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      ) : null}
    </Modal>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="empty-cell">{children}</td></tr>
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
  fields,
  initial,
  submitLabel = "Save",
  note,
  onSubmit,
  onClose,
}: {
  title: string
  fields: FieldDef[]
  initial?: Record<string, string | number | boolean | null | undefined>
  submitLabel?: string
  note?: ReactNode
  onSubmit: (values: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const raw = initial?.[field.name]
        const value = field.type === "checkbox" ? (raw === false ? "" : "1") : raw === null || raw === undefined ? "" : String(raw)
        return [field.name, value]
      }),
    ),
  )
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {error ? <div className="wide"><Banner>{error}</Banner></div> : null}
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
                <select value={value} onChange={(event) => set(event.target.value)} required={field.required}>
                  <option value="">{field.empty || "Choose"}</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
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
        <div className="wide row">
          <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
