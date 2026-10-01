import { useEffect, useState, type FormEvent } from "react"
import { api, type CompanyProfile } from "../api"
import { useAuth } from "../auth"
import { LogoImage, useCompany } from "../company"
import { Banner, Field, PageTitle } from "../ui"
import { DetailModal, EmptyRow, ListToolbar, RecordForm, RowActions, useList } from "../lists"

type Row = Record<string, unknown> & { id: number }

const LISTS: { path: string; label: string; coded?: boolean }[] = [
  { path: "currencies", label: "Currencies", coded: true },
  { path: "payment-methods", label: "Payment methods" },
  { path: "destinations", label: "Destinations" },
  { path: "safari-types", label: "Safari types" },
  { path: "lead-sources", label: "Lead sources" },
  { path: "client-types", label: "Client types" },
  { path: "vendor-types", label: "Accommodation vendor types" },
  { path: "expense-categories", label: "Expense categories" },
]

export function SettingsPage() {
  const { can } = useAuth()
  const { refresh: refreshBranding } = useCompany()
  const [active, setActive] = useState(LISTS[0])
  const [search, setSearch] = useState("")
  const { rows, loading, error: listError, load, remove } = useList<Row>(`/api/${active.path}/`, search)
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const [company, setCompany] = useState<CompanyProfile>({
    name: "",
    email: "",
    phone: "",
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
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const canEdit = can("settings.edit")

  useEffect(() => { api<CompanyProfile>("/api/company/").then(setCompany).catch((err: Error) => setError(err.message)) }, [])
  useEffect(() => { setSearch("") }, [active])

  async function saveCompany(event: FormEvent) {
    event.preventDefault()
    setError("")
    setSaved(false)
    const body = new FormData()
    body.append("name", company.name)
    body.append("email", company.email)
    body.append("phone", company.phone)
    body.append("address", company.address)
    body.append("tagline", company.tagline)
    body.append("welcome_title", company.welcome_title)
    body.append("welcome_text", company.welcome_text)
    body.append("primary_color", company.primary_color)
    body.append("secondary_color", company.secondary_color)
    if (logoFile) body.append("logo", logoFile)
    try {
      await api("/api/company/", { method: "PUT", body })
      setLogoFile(null)
      setCompany(await api<CompanyProfile>("/api/company/"))
      await refreshBranding()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company settings")
    }
  }

  return (
    <>
      <PageTitle title="Settings" lede="Company details, brand colors, and the lists used across the desk." />
      <Banner>{error || listError}</Banner>
      <form className="card form-grid" onSubmit={saveCompany}>
        <Field label="Company name"><input value={company.name} disabled={!canEdit} onChange={(event) => setCompany({ ...company, name: event.target.value })} /></Field>
        <Field label="Nav tagline"><input value={company.tagline} disabled={!canEdit} onChange={(event) => setCompany({ ...company, tagline: event.target.value })} /></Field>
        <Field label="Login headline"><input value={company.welcome_title} disabled={!canEdit} onChange={(event) => setCompany({ ...company, welcome_title: event.target.value })} /></Field>
        <Field label="Login text" wide><textarea value={company.welcome_text} disabled={!canEdit} onChange={(event) => setCompany({ ...company, welcome_text: event.target.value })} /></Field>
        <Field label="Email"><input value={company.email} disabled={!canEdit} onChange={(event) => setCompany({ ...company, email: event.target.value })} /></Field>
        <Field label="Phone"><input value={company.phone} disabled={!canEdit} onChange={(event) => setCompany({ ...company, phone: event.target.value })} /></Field>
        <Field label="Address" wide><textarea value={company.address} disabled={!canEdit} onChange={(event) => setCompany({ ...company, address: event.target.value })} /></Field>
        <Field label="Brand navy"><input type="color" value={company.primary_color || "#2e3192"} disabled={!canEdit} onChange={(event) => setCompany({ ...company, primary_color: event.target.value })} /></Field>
        <Field label="Brand orange"><input type="color" value={company.secondary_color || "#f7941d"} disabled={!canEdit} onChange={(event) => setCompany({ ...company, secondary_color: event.target.value })} /></Field>
        <Field label="Logo" wide>
          <LogoImage className="brand-logo" style={{ maxWidth: 160, marginBottom: 8 }} />
          {canEdit ? <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} /> : null}
        </Field>
        {canEdit ? (
          <div className="wide row">
            <button className="primary" type="submit">Save company</button>
            {saved ? <span className="muted">Saved.</span> : null}
          </div>
        ) : null}
      </form>

      <h2 className="section-title">Lists</h2>
      <div className="perm-tabs no-print">
        {LISTS.map((list) => (
          <button
            type="button"
            key={list.path}
            className={`perm-tab ${list.path === active.path ? "active" : ""}`}
            onClick={() => setActive(list)}
          >
            {list.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder={`Search ${active.label.toLowerCase()}`}
          createLabel={can("settings.create") ? `Add ${active.coded ? "currency" : "item"}` : undefined}
          onCreate={() => setEditing("new")}
        />
        <div className="table-wrap">
          <table>
            <thead><tr>{active.coded ? <th>Code</th> : null}<th>Name</th><th className="actions-col">Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {active.coded ? <td><strong>{String(row.code)}</strong></td> : null}
                  <td>{String(row.name)}</td>
                  <td>
                    <RowActions
                      onView={() => setViewing(row)}
                      onEdit={can("settings.edit") ? () => setEditing(row) : undefined}
                      onDelete={can("settings.delete") ? () => remove(row.id) : undefined}
                      deleteName={String(row.name)}
                    />
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? <EmptyRow colSpan={active.coded ? 3 : 2}>Nothing in this list yet.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
      </div>
      {viewing ? (
        <DetailModal
          title={String(viewing.name)}
          items={[
            ["List", active.label],
            ...(active.coded ? [["Code", String(viewing.code)] as [string, string]] : []),
            ["Name", String(viewing.name)],
          ]}
          onClose={() => setViewing(null)}
          onEdit={can("settings.edit") ? () => { setEditing(viewing); setViewing(null) } : undefined}
        />
      ) : null}
      {editing ? (
        <RecordForm
          title={editing === "new" ? `Add to ${active.label.toLowerCase()}` : `Edit ${String(editing.name)}`}
          initial={editing === "new" ? {} : { code: editing.code as string, name: editing.name as string }}
          fields={[
            ...(active.coded ? [{ name: "code", label: "Code", required: true, placeholder: "For example TSH" }] : []),
            { name: "name", label: "Name", required: true },
          ]}
          onSubmit={async (values) => {
            const body = JSON.stringify(active.coded ? { code: values.code, name: values.name } : { name: values.name })
            if (editing === "new") await api(`/api/${active.path}/`, { method: "POST", body })
            else await api(`/api/${active.path}/${editing.id}/`, { method: "PATCH", body })
            setEditing(null)
            load()
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}
