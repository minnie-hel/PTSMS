import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Field, Modal, PageTitle, moneyList } from "../ui"
import { useToast } from "../toast"
import { EmptyRow, ListToolbar, RowActions, monthFilterOptions, useListScreen, type ListFilterField, type ListStatusTab } from "../lists"
import { CLIENT_STATUS_TABS } from "../listTabs"
import { ProcessFlow } from "../workflow"

type Option = { id: number; name?: string; code?: string; full_name?: string }
type Lead = {
  id: number
  reference: string
  full_name: string
  email: string
  phone: string
  whatsapp: string
  contact_channel: string
  contact_channel_label: string
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
  assigned_name?: string
  destination_names?: string[]
  safari_type_name?: string
  source_name?: string
  currency_code?: string
}

const LEAD_STATUSES = [
  { value: "new", label: "New inquiry" },
  { value: "contacted", label: "In contact" },
  { value: "qualified", label: "Qualified" },
  { value: "quotation_sent", label: "Quotation sent" },
  { value: "follow_up", label: "Follow-up needed" },
  { value: "negotiation", label: "Negotiating" },
  { value: "won", label: "Won — booking opened" },
  { value: "lost", label: "Lost" },
  { value: "unqualified", label: "Not a fit" },
]
const CONTACT_CHANNELS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone call" },
  { value: "website", label: "Website / form" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
]
const emptyLead = {
  full_name: "", email: "", phone: "", whatsapp: "", contact_channel: "", country: "", city: "", travel_date: "",
  adults: 1, children: 0, destination_ids: [] as number[], safari_type: "", budget: "", currency: "",
  source: "", campaign: "", assigned_to: "", status: "new", priority: "normal", next_follow_up: "", notes: "",
}

const LEAD_STATUS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  ...LEAD_STATUSES.map((item) => ({ value: item.value, label: item.label })),
]

const LEAD_FILTER_FIELDS: ListFilterField[] = [
  {
    key: "priority",
    label: "Any priority",
    options: [
      { value: "low", label: "Low" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "High" },
    ],
  },
  { key: "month", label: "Any month", options: monthFilterOptions(), clientOnly: true },
]

export function LeadsPage() {
  const { can } = useAuth()
  const screen = useListScreen<Lead>("/api/leads/", {
    statusKey: "status",
    statusTabs: LEAD_STATUS_TABS,
    filterFields: LEAD_FILTER_FIELDS,
    dateKey: "travel_date",
  })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<Lead | "new" | null>(null)
  const navigate = useNavigate()

  return (
    <>
      <PageTitle title="Leads" lede="Every inquiry that reaches the office or any other channel." />
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={LEAD_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={LEAD_FILTER_FIELDS}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("leads.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Lead</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr className="click" key={row.id} onClick={() => navigate(`/leads/${row.id}`)}>
                <td><strong>{row.full_name}</strong></td>
                <td><Badge value={row.status} label={row.status_label} /></td>
                <td>
                  <RowActions
                    viewTo={`/leads/${row.id}`}
                    onEdit={can("leads.edit") ? async () => setEditing(await api<Lead>(`/api/leads/${row.id}/`)) : undefined}
                    onDelete={can("leads.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={row.full_name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={3}>No leads match.</EmptyRow> : null}
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
    api<Lead>(`/api/leads/${id}/`).then(setLead).catch(() => {})
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
      <ProcessFlow
        title="Customer journey"
        steps={[
          { id: "lead", label: "Lead", done: true, current: !lead.converted_client },
          {
            id: "client",
            label: "Client",
            to: lead.converted_client ? `/clients/${lead.converted_client}` : undefined,
            done: Boolean(lead.converted_client),
            current: Boolean(lead.converted_client),
          },
          { id: "booking", label: "Booking file", to: `/bookings/new?lead=${lead.id}`, done: lead.status === "won", current: false },
          { id: "quotation", label: "Quotation", done: false },
          { id: "invoice", label: "Invoice & payment", done: false },
        ]}
      />
      <PageTitle title={lead.full_name} lede={`${lead.reference} · ${lead.country || "Country not set"}`} backTo="/leads" backLabel="Leads">
        {can("leads.edit") ? <button onClick={() => setEditing(true)}>Edit</button> : null}
        {can("clients.create") && !lead.converted_client ? <button onClick={convert}>Convert to client</button> : null}
        {can("bookings.create") ? <Link className="button primary" to={`/bookings/new?lead=${lead.id}`}>Create booking</Link> : null}
      </PageTitle>
      <div className="grid-2">
        <div className="card">
          <dl className="detail-list">
            <dt>Status</dt><dd><Badge value={lead.status} label={lead.status_label} /></dd>
            <dt>Contact channel</dt><dd>{lead.contact_channel_label || "—"}</dd>
            <dt>Email</dt><dd>{lead.email || "—"}</dd>
            <dt>Phone</dt><dd>{lead.phone || "—"}</dd>
            <dt>WhatsApp</dt><dd>{lead.whatsapp || "—"}</dd>
            <dt>Country</dt><dd>{lead.country || "—"}</dd>
            <dt>City</dt><dd>{lead.city || "—"}</dd>
            <dt>Travel date</dt><dd>{lead.travel_date || "—"}</dd>
            <dt>Travellers</dt><dd>{lead.adults} adults, {lead.children} children</dd>
            <dt>Next follow-up</dt><dd>{lead.next_follow_up || "—"}</dd>
            <dt>Assigned to</dt><dd>{lead.assigned_name || "Unassigned"}</dd>
            <dt>Notes</dt><dd>{lead.notes || "—"}</dd>
            {lead.client_reference ? <><dt>Client</dt><dd>{lead.client_reference}</dd></> : null}
          </dl>
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

function LeadForm({ initial, onClose, onSaved }: { initial?: Lead; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    ...emptyLead,
    full_name: initial?.full_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    whatsapp: initial?.whatsapp || "",
    contact_channel: initial?.contact_channel || "",
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
      contact_channel: form.contact_channel || null,
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
      await api<Lead>(initial ? `/api/leads/${initial.id}/` : "/api/leads/", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(initial ? "Lead updated successfully" : "Lead created successfully")
      onSaved()
    } catch {
      // toasted
    }
  }

  return (
    <Modal title={initial ? "Edit lead" : "New lead"} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <Banner>{error}</Banner>
        <p className="muted">Record who contacted the company, from which country, and how they reached you.</p>
        <div className="form-grid">
          <Field label="Full name"><input value={form.full_name} onChange={(event) => set("full_name", event.target.value)} required /></Field>
          <Field label="Country of origin"><input value={form.country} onChange={(event) => set("country", event.target.value)} required /></Field>
          <Field label="How they contacted us">
            <select value={form.contact_channel} onChange={(event) => set("contact_channel", event.target.value)} required>
              <option value="">Choose channel</option>
              {CONTACT_CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="WhatsApp"><input value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} /></Field>
          <Field label="Travel date"><input type="date" value={form.travel_date || ""} onChange={(event) => set("travel_date", event.target.value)} /></Field>
          <Field label="Adults"><input type="number" min={0} value={form.adults} onChange={(event) => set("adults", Number(event.target.value))} /></Field>
          <Field label="Children"><input type="number" min={0} value={form.children} onChange={(event) => set("children", Number(event.target.value))} /></Field>
          <Field label="Assigned to">
            <select value={form.assigned_to || ""} onChange={(event) => set("assigned_to", event.target.value)}>
              <option value="">Unassigned</option>
              {options.staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
            </select>
          </Field>
          <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="What the traveller wants…" /></Field>
        </div>
        <h3 className="form-section-title">Travel & qualification</h3>
        <div className="form-grid">
          <Field label="City"><input value={form.city} onChange={(event) => set("city", event.target.value)} /></Field>
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
          <Field label="Campaign"><input value={form.campaign} onChange={(event) => set("campaign", event.target.value)} placeholder="e.g. Google Ads" /></Field>
          <Field label="Budget"><input value={form.budget || ""} onChange={(event) => set("budget", event.target.value)} /></Field>
          <Field label="Budget currency">
            <select value={form.currency || ""} onChange={(event) => set("currency", event.target.value)}>
              <option value="">Not set</option>
              {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(event) => set("priority", event.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => set("status", event.target.value)}>
              {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Next follow-up"><input type="date" value={form.next_follow_up || ""} onChange={(event) => set("next_follow_up", event.target.value)} /></Field>
          <Field label="Destinations" wide>
            <div className="checks">
              {options.destinations.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={form.destination_ids.includes(item.id)}
                    onChange={(event) =>
                      set(
                        "destination_ids",
                        event.target.checked
                          ? [...form.destination_ids, item.id]
                          : form.destination_ids.filter((value) => value !== item.id),
                      )
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="form-footer">
          <button className="primary" type="submit">{initial ? "Save" : "Create lead"}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
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
  type_name?: string
  source_name?: string
  assigned_name?: string
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
  const screen = useListScreen<ClientRow>("/api/clients/", {
    statusKey: "status",
    statusTabs: CLIENT_STATUS_TABS,
    filterFields: [{ key: "month", label: "Any month", options: monthFilterOptions(), clientOnly: true }],
    dateKey: "created_at",
  })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<ClientRow | "new" | null>(null)
  const navigate = useNavigate()
  return (
    <>
      <PageTitle title="Clients" lede="A returning guest keeps this record. The next safari is a new booking." />
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={CLIENT_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={[{ key: "month", label: "Any month", options: monthFilterOptions(), clientOnly: true }]}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("clients.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Client</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr className="click" key={row.id} onClick={() => navigate(`/clients/${row.id}`)}>
                <td><strong>{row.full_name}</strong></td>
                <td><Badge value={row.status} label={row.status_label} /></td>
                <td>
                  <RowActions
                    viewTo={`/clients/${row.id}`}
                    onEdit={can("clients.edit") ? async () => setEditing(await api<ClientRow>(`/api/clients/${row.id}/`)) : undefined}
                    onDelete={can("clients.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={row.full_name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={3}>No clients match. Convert a lead, or create a booking from one.</EmptyRow> : null}
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

type ClientProfile = {
  quotation_count: number
  booking_count: number
  confirmed_bookings: number
  total_invoiced: { currency: string; amount: string }[]
  total_paid: { currency: string; amount: string }[]
  outstanding: { currency: string; amount: string }[]
  quotations: { id: number; number: string; status: string; total_amount: string; currency_code: string; booking_reference: string }[]
  bookings: { id: number; reference: string; start_date: string; overall_status: string; total_amount: string; currency_code: string }[]
  invoices: { id: number; number: string; booking_reference: string; total_amount: string; balance: string; currency_code: string; effective_status: string }[]
  payments: { id: number; paid_on: string; amount: string; currency_code: string; booking_reference: string; invoice_number: string }[]
  activities: { id: number; type_label: string; body: string; created_by_name: string; created_at: string }[]
  source_leads: { id: number; reference: string; full_name: string }[]
}

export function ClientDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [client, setClient] = useState<ClientRow | null>(null)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [editing, setEditing] = useState(false)
  function load() {
    api<ClientRow>(`/api/clients/${id}/`).then(setClient)
    api<ClientProfile>(`/api/clients/${id}/profile/`).then(setProfile)
  }
  useEffect(() => { load() }, [id])
  if (!client || !profile) return <p>Loading client…</p>
  return (
    <>
      <PageTitle title={client.full_name} lede={`${client.reference} · ${client.country || "Country not set"}`} backTo="/clients" backLabel="Clients">
        {can("clients.edit") ? <button type="button" onClick={() => setEditing(true)}>Edit client</button> : null}
        {can("bookings.create") ? <Link className="button primary" to={`/bookings/new?client=${client.id}`}>New booking</Link> : null}
      </PageTitle>
      <div className="stats">
        <div className="stat"><b>{profile.quotation_count}</b><span>Quotations</span></div>
        <div className="stat"><b>{profile.confirmed_bookings}</b><span>Confirmed bookings</span></div>
        <div className="stat"><b>{moneyList(profile.total_invoiced)}</b><span>Total invoiced</span></div>
        <div className="stat"><b>{moneyList(profile.total_paid)}</b><span>Total paid</span></div>
        <div className="stat"><b>{moneyList(profile.outstanding)}</b><span>Outstanding</span></div>
      </div>
      <div className="card">
        <dl className="detail-list">
          <dt>Status</dt><dd><Badge value={client.status} label={client.status_label} /></dd>
          <dt>Type</dt><dd>{client.type_name || "—"}</dd>
          <dt>Source</dt><dd>{client.source_name || "—"}</dd>
          <dt>Consultant</dt><dd>{client.assigned_name || "Unassigned"}</dd>
          <dt>Email</dt><dd>{client.email || "—"}</dd>
          <dt>Phone</dt><dd>{client.phone || "—"}</dd>
          <dt>WhatsApp</dt><dd>{client.whatsapp || "—"}</dd>
          <dt>City</dt><dd>{client.city || "—"}</dd>
          <dt>Address</dt><dd>{client.address || "—"}</dd>
          <dt>Notes</dt><dd>{client.notes || "—"}</dd>
          {profile.source_leads.length ? (
            <>
              <dt>From lead</dt>
              <dd>{profile.source_leads.map((lead) => <Link key={lead.id} to={`/leads/${lead.id}`}>{lead.reference}</Link>)}</dd>
            </>
          ) : null}
        </dl>
      </div>
      <h2>Quotations</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Number</th><th>Booking</th><th>Fee</th><th>Status</th></tr></thead>
          <tbody>
            {profile.quotations.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/quotations/${row.id}`}>{row.number}</Link></td>
                <td>{row.booking_reference}</td>
                <td>{row.currency_code} {row.total_amount}</td>
                <td><Badge value={row.status} /></td>
              </tr>
            ))}
            {profile.quotations.length === 0 ? <tr><td colSpan={4} className="empty-cell">No quotations yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <h2>Bookings</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Start</th><th>Fee</th><th>Status</th></tr></thead>
          <tbody>
            {profile.bookings.map((row) => (
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
      {profile.invoices.length ? (
        <>
          <h2>Invoices</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Booking</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {profile.invoices.map((row) => (
                  <tr key={row.id}>
                    <td><Link to={`/invoices/${row.id}`}>{row.number}</Link></td>
                    <td>{row.booking_reference}</td>
                    <td>{row.currency_code} {row.balance}</td>
                    <td><Badge value={row.effective_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {profile.payments.length ? (
        <>
          <h2>Payments</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Invoice</th><th>Booking</th><th>Amount</th></tr></thead>
              <tbody>
                {profile.payments.map((row) => (
                  <tr key={row.id}>
                    <td>{row.paid_on}</td>
                    <td>{row.invoice_number}</td>
                    <td>{row.booking_reference}</td>
                    <td>{row.currency_code} {row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <h2>Activity</h2>
      <div className="card">
        {profile.activities.length ? profile.activities.map((item) => (
          <p key={item.id}><strong>{item.type_label}.</strong> {item.body} <span className="muted">· {item.created_by_name}</span></p>
        )) : <p className="muted">No activity recorded on this client yet.</p>}
      </div>
      {editing ? (
        <ClientForm
          initial={client}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      ) : null}
    </>
  )
}

function ClientForm({ initial, onClose, onSaved }: { initial?: ClientRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    whatsapp: initial?.whatsapp || "",
    country: initial?.country || "",
    city: initial?.city || "",
    address: initial?.address || "",
    client_type: initial?.client_type ? String(initial.client_type) : "",
    source: initial?.source ? String(initial.source) : "",
    assigned_to: initial?.assigned_to ? String(initial.assigned_to) : "",
    notes: initial?.notes || "",
  })
  const [options, setOptions] = useState<{ types: { id: number; name: string }[]; sources: { id: number; name: string }[]; staff: { id: number; full_name: string }[] }>({ types: [], sources: [], staff: [] })
  const [error, setError] = useState("")
  useEffect(() => {
    Promise.all([
      apiList<{ id: number; name: string }>("/api/client-types/"),
      apiList<{ id: number; name: string }>("/api/lead-sources/"),
      apiList<{ id: number; full_name: string }>("/api/staff/"),
    ]).then(([types, sources, staff]) => setOptions({ types, sources, staff }))
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await api(initial ? `/api/clients/${initial.id}/` : "/api/clients/", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          client_type: form.client_type ? Number(form.client_type) : null,
          source: form.source ? Number(form.source) : null,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        }),
      })
      toast.success(initial ? "Client updated successfully" : "Client created successfully")
      onSaved()
    } catch {
      // toasted
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
        <Field label="Client type">
          <select value={form.client_type} onChange={(event) => setForm({ ...form, client_type: event.target.value })}>
            <option value="">Not set</option>
            {options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
            <option value="">Not set</option>
            {options.sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Assigned consultant">
          <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
            <option value="">Unassigned</option>
            {options.staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
        </Field>
        <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <div className="form-footer wide">
          <button className="primary" type="submit">{initial ? "Save changes" : "Save client"}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
