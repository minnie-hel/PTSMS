import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Field, Modal, PageTitle } from "../ui"
import { EmptyRow, FilterSelect, ListToolbar, RowActions, useList } from "../lists"

type Option = { id: number; name?: string; code?: string; full_name?: string }
type Lead = {
  id: number
  reference: string
  full_name: string
  email: string
  phone: string
  whatsapp: string
  country: string
  city: string
  travel_date: string | null
  adults: number
  children: number
  destination_ids: number[]
  safari_type: number | null
  budget: string | null
  currency: number | null
  source: number | null
  campaign: string
  assigned_to: number | null
  status: string
  status_label: string
  priority: string
  next_follow_up: string | null
  notes: string
  converted_client: number | null
  client_reference: string | null
}

const LEAD_STATUSES = ["new", "contacted", "qualified", "quotation_sent", "follow_up", "negotiation", "won", "lost", "unqualified"]
const emptyLead = {
  full_name: "", email: "", phone: "", whatsapp: "", country: "", city: "", travel_date: "",
  adults: 1, children: 0, destination_ids: [] as number[], safari_type: "", budget: "", currency: "",
  source: "", campaign: "", assigned_to: "", status: "new", priority: "normal", next_follow_up: "", notes: "",
}

export function LeadsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const { rows, loading, error, load, remove } = useList<Lead>("/api/leads/", search, { status, priority })
  const [editing, setEditing] = useState<Lead | "new" | null>(null)
  const navigate = useNavigate()

  return (
    <>
      <PageTitle title="Leads" lede="Every inquiry that reaches the office or any other channel." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, phone, country"
        createLabel={can("leads.create") ? "New lead" : undefined}
        onCreate={() => setEditing("new")}
        filters={
          <>
            <FilterSelect value={status} onChange={setStatus} label="All statuses" options={LEAD_STATUSES.map((item) => ({ value: item, label: item.replace("_", " ") }))} />
            <FilterSelect value={priority} onChange={setPriority} label="Any priority" options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
          </>
        }
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Lead</th><th>Contact</th><th>Travel</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr className="click" key={row.id} onClick={() => navigate(`/leads/${row.id}`)}>
                <td><strong>{row.full_name}</strong><div className="muted">{row.reference}</div></td>
                <td>{row.email || row.phone || "—"}<div className="muted">{row.country}</div></td>
                <td>{row.travel_date || "—"}</td>
                <td><Badge value={row.status} label={row.status_label} /></td>
                <td>
                  <RowActions
                    viewTo={`/leads/${row.id}`}
                    onEdit={can("leads.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("leads.delete") ? () => remove(row.id) : undefined}
                    deleteName={row.full_name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No leads match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <LeadForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      ) : null}
    </>
  )
}

export function LeadDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<{ id: number; type_label: string; body: string; created_at: string }[]>([])
  const [note, setNote] = useState("")
  const [kind, setKind] = useState("note")
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)

  function load() {
    api<Lead>(`/api/leads/${id}/`).then(setLead).catch((err: Error) => setError(err.message))
    apiList<typeof activities[number]>(`/api/activities/?lead=${id}&page_size=100`).then(setActivities).catch(() => setActivities([]))
  }
  useEffect(() => { load() }, [id])

  async function addNote(event: FormEvent) {
    event.preventDefault()
    await api("/api/activities/", { method: "POST", body: JSON.stringify({ lead: Number(id), activity_type: kind, body: note }) })
    setNote("")
    load()
  }

  async function convert() {
    const client = await api<{ id: number }>(`/api/leads/${id}/convert/`, { method: "POST", body: "{}" })
    window.location.assign(`/clients/${client.id}`)
  }

  if (!lead) return error ? <Banner>{error}</Banner> : <p>Loading lead…</p>
  return (
    <>
      <PageTitle title={lead.full_name} lede={`${lead.reference} · ${lead.country || "Country not set"}`}>
        {can("leads.edit") ? <button onClick={() => setEditing(true)}>Edit</button> : null}
        {can("clients.create") && !lead.converted_client ? <button onClick={convert}>Convert to client</button> : null}
        {can("bookings.create") ? <Link className="button primary" to={`/bookings/new?lead=${lead.id}`}>Create booking</Link> : null}
      </PageTitle>
      <div className="grid-2">
        <div className="card">
          <p>{lead.email} · {lead.phone} · WhatsApp {lead.whatsapp || "—"}</p>
          <p>{lead.adults} adults, {lead.children} children · travel {lead.travel_date || "not set"}</p>
          <p>Budget {lead.budget || "—"} · next follow-up {lead.next_follow_up || "—"}</p>
          <p><Badge value={lead.status} label={lead.status_label} /></p>
          {lead.client_reference ? <p>Client {lead.client_reference}</p> : null}
          <p>{lead.notes}</p>
        </div>
        <div className="card">
          <h2>Activity</h2>
          {can("leads.create") ? (
            <form onSubmit={addNote} className="stack">
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                {["call", "email", "whatsapp", "meeting", "note", "follow_up", "other"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} required placeholder="What happened?" />
              <button type="submit">Add</button>
            </form>
          ) : null}
          {activities.map((item) => (
            <p key={item.id}><strong>{item.type_label}.</strong> {item.body}</p>
          ))}
        </div>
      </div>
      {editing ? <LeadForm initial={lead} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} /> : null}
    </>
  )
}

function LeadForm({ initial, onClose, onSaved }: { initial?: Lead; onClose: () => void; onSaved: (id: number) => void }) {
  const [form, setForm] = useState({
    ...emptyLead,
    full_name: initial?.full_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    whatsapp: initial?.whatsapp || "",
    country: initial?.country || "",
    city: initial?.city || "",
    campaign: initial?.campaign || "",
    notes: initial?.notes || "",
    adults: initial?.adults ?? 1,
    children: initial?.children ?? 0,
    status: initial?.status || "new",
    priority: initial?.priority || "normal",
    destination_ids: initial?.destination_ids || [],
    travel_date: initial?.travel_date || "",
    next_follow_up: initial?.next_follow_up || "",
    safari_type: initial?.safari_type || "",
    currency: initial?.currency || "",
    source: initial?.source || "",
    assigned_to: initial?.assigned_to || "",
    budget: initial?.budget || "",
  })
  const [options, setOptions] = useState<{ destinations: Option[]; types: Option[]; currencies: Option[]; sources: Option[]; staff: Option[] }>({ destinations: [], types: [], currencies: [], sources: [], staff: [] })
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      apiList<Option>("/api/destinations/"),
      apiList<Option>("/api/safari-types/"),
      apiList<Option>("/api/currencies/"),
      apiList<Option>("/api/lead-sources/"),
      apiList<Option>("/api/staff/"),
    ]).then(([destinations, types, currencies, sources, staff]) => setOptions({ destinations, types, currencies, sources, staff }))
  }, [])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      country: form.country,
      city: form.city,
      travel_date: emptyToNull(form.travel_date),
      next_follow_up: emptyToNull(form.next_follow_up),
      adults: form.adults,
      children: form.children,
      destination_ids: form.destination_ids,
      safari_type: emptyToNull(form.safari_type),
      budget: emptyToNull(form.budget),
      currency: emptyToNull(form.currency),
      source: emptyToNull(form.source),
      campaign: form.campaign,
      assigned_to: emptyToNull(form.assigned_to),
      status: form.status,
      priority: form.priority,
      notes: form.notes,
    }
    try {
      const saved = await api<Lead>(initial ? `/api/leads/${initial.id}/` : "/api/leads/", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      onSaved(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the lead")
    }
  }

  return (
    <Modal title={initial ? "Edit lead" : "New lead"} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <Banner>{error}</Banner>
        <div className="form-grid">
          <Field label="Full name"><input value={form.full_name} onChange={(event) => set("full_name", event.target.value)} required /></Field>
          <Field label="Email"><input value={form.email} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="WhatsApp"><input value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} /></Field>
          <Field label="Country"><input value={form.country} onChange={(event) => set("country", event.target.value)} /></Field>
          <Field label="City"><input value={form.city} onChange={(event) => set("city", event.target.value)} /></Field>
          <Field label="Travel date"><input type="date" value={form.travel_date || ""} onChange={(event) => set("travel_date", event.target.value)} /></Field>
          <Field label="Next follow-up"><input type="date" value={form.next_follow_up || ""} onChange={(event) => set("next_follow_up", event.target.value)} /></Field>
          <Field label="Adults"><input type="number" min={0} value={form.adults} onChange={(event) => set("adults", Number(event.target.value))} /></Field>
          <Field label="Children"><input type="number" min={0} value={form.children} onChange={(event) => set("children", Number(event.target.value))} /></Field>
          <Field label="Safari type">
            <select value={form.safari_type || ""} onChange={(event) => set("safari_type", event.target.value)}>
              <option value="">Choose later</option>
              {options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select value={form.source || ""} onChange={(event) => set("source", event.target.value)}>
              <option value="">Not set</option>
              {options.sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Budget"><input value={form.budget || ""} onChange={(event) => set("budget", event.target.value)} /></Field>
          <Field label="Currency">
            <select value={form.currency || ""} onChange={(event) => set("currency", event.target.value)}>
              <option value="">Not set</option>
              {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          <Field label="Campaign"><input value={form.campaign} onChange={(event) => set("campaign", event.target.value)} /></Field>
          <Field label="Assigned to">
            <select value={form.assigned_to || ""} onChange={(event) => set("assigned_to", event.target.value)}>
              <option value="">Unassigned</option>
              {options.staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => set("status", event.target.value)}>
              {LEAD_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(event) => set("priority", event.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Destinations" wide>
            <div className="checks">
              {options.destinations.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={form.destination_ids.includes(item.id)}
                    onChange={(event) => {
                      set("destination_ids", event.target.checked
                        ? [...form.destination_ids, item.id]
                        : form.destination_ids.filter((value) => value !== item.id))
                    }}
                  />
                  {item.name}
                </label>
              ))}
              {options.destinations.length === 0 ? <span>Add destinations in Settings.</span> : null}
            </div>
          </Field>
          <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} /></Field>
        </div>
        <button className="primary" type="submit">Save lead</button>
      </form>
    </Modal>
  )
}

type ClientRow = {
  id: number
  reference: string
  full_name: string
  email: string
  phone: string
  country: string
  status: string
  status_label: string
  booking_count: number
  contact_person: string
  whatsapp: string
  city: string
  address: string
  notes: string
  client_type: number | null
  source: number | null
  assigned_to: number | null
  next_follow_up: string | null
}

export function ClientsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<ClientRow>("/api/clients/", search, { status })
  const [editing, setEditing] = useState<ClientRow | "new" | null>(null)
  const navigate = useNavigate()
  return (
    <>
      <PageTitle title="Clients" lede="A returning guest keeps this record. The next safari is a new booking." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, phone, country"
        createLabel={can("clients.create") ? "New client" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={status} onChange={setStatus} label="All statuses" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Client</th><th>Country</th><th>Bookings</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr className="click" key={row.id} onClick={() => navigate(`/clients/${row.id}`)}>
                <td><strong>{row.full_name}</strong><div className="muted">{row.reference}</div></td>
                <td>{row.country || "—"}</td>
                <td>{row.booking_count}</td>
                <td><Badge value={row.status} label={row.status_label} /></td>
                <td>
                  <RowActions
                    viewTo={`/clients/${row.id}`}
                    onEdit={can("clients.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("clients.delete") ? () => remove(row.id) : undefined}
                    deleteName={row.full_name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No clients match. Convert a lead, or create a booking from one.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <ClientForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      ) : null}
    </>
  )
}

export function ClientDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [client, setClient] = useState<ClientRow | null>(null)
  const [bookings, setBookings] = useState<{ id: number; reference: string; start_date: string; total_amount: string; currency_code: string; overall_status: string }[]>([])
  useEffect(() => {
    api<ClientRow>(`/api/clients/${id}/`).then(setClient)
    apiList<typeof bookings[number]>(`/api/bookings/?client=${id}&page_size=100`).then(setBookings)
  }, [id])
  if (!client) return <p>Loading client…</p>
  return (
    <>
      <PageTitle title={client.full_name} lede={`${client.reference} · ${client.country || "Country not set"}`}>
        {can("bookings.create") ? <Link className="button primary" to={`/bookings/new?client=${client.id}`}>New booking</Link> : null}
      </PageTitle>
      <div className="card">
        <p>{client.email} · {client.phone}</p>
        <p>{client.notes}</p>
      </div>
      <h2>Bookings</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Start</th><th>Fee</th><th>Status</th></tr></thead>
          <tbody>
            {bookings.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                <td>{row.start_date}</td>
                <td>{row.currency_code} {row.total_amount}</td>
                <td><Badge value={row.overall_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ClientForm({ initial, onClose, onSaved }: { initial?: ClientRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    whatsapp: initial?.whatsapp || "",
    country: initial?.country || "",
    city: initial?.city || "",
    address: initial?.address || "",
    notes: initial?.notes || "",
  })
  const [error, setError] = useState("")
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await api(initial ? `/api/clients/${initial.id}/` : "/api/clients/", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(form),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save")
    }
  }
  return (
    <Modal title={initial ? "Edit client" : "New client"} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Banner>{error}</Banner>
        <Field label="Full name" wide><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></Field>
        <Field label="Email"><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="Country"><input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
        <Field label="City"><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
        <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <button className="primary" type="submit">{initial ? "Save changes" : "Save client"}</button>
      </form>
    </Modal>
  )
}
