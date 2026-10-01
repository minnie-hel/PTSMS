import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { api, apiList } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Modal, PageTitle } from "../ui"
import { EmptyRow, FilterSelect, ListToolbar, RecordForm, RowActions } from "../lists"
import { ModuleCard, type Tone } from "../cards"
import { IconBell, IconCalendar, IconCompass, IconDocument, IconReceipt, IconUser, IconUsers } from "../icons"

type Money = { currency: string; amount: string }
type DashboardData = {
  leads: number
  active_clients: number
  quotations: number
  confirmed_bookings: number
  upcoming_safaris: number
  open_invoices: number
  overdue_invoices: number
  follow_ups_due: number
  payments_received: Money[]
  outstanding: Money[]
  expenses: Money[]
  gross_profit: Money[]
}

type StatCard = { label: string; value: number; to: string; icon: ReactNode; tone: Tone }

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [currencies, setCurrencies] = useState<unknown[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api<DashboardData>("/api/dashboard/")
      .then(setData)
      .catch((err: Error) => setError(err.message))
    apiList("/api/currencies/").then(setCurrencies).catch(() => setCurrencies([]))
  }, [])

  const cards: StatCard[] = data
    ? [
        { label: "Leads", value: data.leads, to: "/leads", icon: <IconUsers />, tone: "navy" },
        { label: "Active clients", value: data.active_clients, to: "/clients", icon: <IconUser />, tone: "teal" },
        { label: "Quotations", value: data.quotations, to: "/quotations", icon: <IconDocument />, tone: "orange" },
        { label: "Confirmed bookings", value: data.confirmed_bookings, to: "/bookings", icon: <IconCalendar />, tone: "green" },
        { label: "Upcoming safaris", value: data.upcoming_safaris, to: "/operations", icon: <IconCompass />, tone: "purple" },
        { label: "Follow-ups due", value: data.follow_ups_due, to: "/follow-ups", icon: <IconBell />, tone: "amber" },
        { label: "Open invoices", value: data.open_invoices, to: "/invoices", icon: <IconReceipt />, tone: "navy" },
        { label: "Overdue invoices", value: data.overdue_invoices, to: "/invoices", icon: <IconReceipt />, tone: "rose" },
      ]
    : []

  return (
    <>
      <PageTitle
        title={`${greeting()}${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        lede="Here is where the desk stands today."
      />
      {error ? <div className="banner">{error}</div> : null}
      {currencies && currencies.length === 0 ? (
        <p className="note">Add currencies and lists in Settings before you record fees and hotel costs.</p>
      ) : null}
      {!data && !error ? <p className="muted">Loading overview…</p> : null}
      <div className="module-grid">
        {cards.map((card) => (
          <ModuleCard key={card.label} to={card.to} icon={card.icon} tone={card.tone} label={card.label} value={card.value} />
        ))}
      </div>
    </>
  )
}

type FollowUpRow = { kind: string; id: number; name: string; reference: string; date: string; state: string }
type LeadOption = { id: number; full_name: string; reference: string }

const STATE_LABEL: Record<string, string> = { overdue: "Overdue", due: "Due today", upcoming: "Upcoming" }

export function FollowUpsPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [search, setSearch] = useState("")
  const [state, setState] = useState("")
  const [kind, setKind] = useState("")
  const [error, setError] = useState("")
  const [form, setForm] = useState<FollowUpRow | "new" | null>(null)
  const [leads, setLeads] = useState<LeadOption[]>([])

  function load() {
    api<FollowUpRow[]>("/api/follow-ups/").then(setRows).catch((err: Error) => setError(err.message))
  }
  useEffect(() => {
    load()
    apiList<LeadOption>("/api/leads/?page_size=200").then(setLeads).catch(() => setLeads([]))
  }, [])

  const shown = rows.filter((row) => {
    const text = `${row.name} ${row.reference}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!state || row.state === state) && (!kind || row.kind === kind)
  })
  const path = (row: FollowUpRow) => `/api/${row.kind}s/${row.id}/`

  return (
    <>
      <PageTitle title="Follow-ups" lede="Leads and clients with a next date." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name or reference"
        createLabel={can("leads.edit") ? "Schedule follow-up" : undefined}
        onCreate={() => setForm("new")}
        filters={
          <>
            <FilterSelect value={state} onChange={setState} label="Any timing" options={Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect value={kind} onChange={setKind} label="Leads and clients" options={[{ value: "lead", label: "Leads" }, { value: "client", label: "Clients" }]} />
          </>
        }
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Record</th><th>Timing</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.date}</td>
                <td><strong>{row.name}</strong><div className="muted">{row.kind === "lead" ? "Lead" : "Client"}</div></td>
                <td>{row.reference}</td>
                <td><Badge value={row.state} label={STATE_LABEL[row.state] || row.state} /></td>
                <td>
                  <RowActions
                    viewTo={`/${row.kind}s/${row.id}`}
                    onEdit={can(`${row.kind}s.edit`) ? () => setForm(row) : undefined}
                    onDelete={can(`${row.kind}s.edit`) ? async () => {
                      await api(path(row), { method: "PATCH", body: JSON.stringify({ next_follow_up: null }) })
                      load()
                    } : undefined}
                    deleteName={`the follow-up for ${row.name}`}
                  />
                </td>
              </tr>
            ))}
            {shown.length === 0 ? <EmptyRow colSpan={5}>No follow-ups scheduled.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {form ? (
        <RecordForm
          title={form === "new" ? "Schedule follow-up" : `Follow-up for ${form.name}`}
          initial={form === "new" ? {} : { date: form.date }}
          fields={[
            ...(form === "new"
              ? [{ name: "lead", label: "Lead", type: "select" as const, required: true, options: leads.map((lead) => ({ value: lead.id, label: `${lead.full_name} (${lead.reference})` })) }]
              : []),
            { name: "date", label: "Follow-up date", type: "date", required: true },
          ]}
          onSubmit={async (values) => {
            const target = form === "new" ? `/api/leads/${values.lead}/` : path(form)
            await api(target, { method: "PATCH", body: JSON.stringify({ next_follow_up: values.date }) })
            setForm(null)
            load()
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
    </>
  )
}

type ActivityRow = { id: number; type_label: string; activity_type: string; body: string; created_by_name: string; created_at: string; lead: number | null }

const ACTIVITY_TYPES = ["call", "email", "whatsapp", "meeting", "note", "follow_up", "other"]
const FILTER_TYPES = [...ACTIVITY_TYPES, "quotation"]

export function ActivitiesPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<ActivityRow | null>(null)
  const [leads, setLeads] = useState<LeadOption[]>([])

  function load() {
    apiList<ActivityRow>("/api/activities/?page_size=200").then(setRows).catch((err: Error) => setError(err.message))
  }
  useEffect(() => {
    load()
    apiList<LeadOption>("/api/leads/?page_size=200").then(setLeads).catch(() => setLeads([]))
  }, [])

  const shown = rows.filter((row) => {
    const text = `${row.body} ${row.created_by_name} ${row.type_label}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!type || row.activity_type === type)
  })

  return (
    <>
      <PageTitle title="Activities" lede="Calls, messages, quotations, and notes recorded by staff." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search notes or staff"
        createLabel={can("leads.create") ? "New activity" : undefined}
        onCreate={() => setCreating(true)}
        filters={<FilterSelect value={type} onChange={setType} label="All types" options={FILTER_TYPES.map((item) => ({ value: item, label: item.replace("_", " ") }))} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Note</th><th>By</th><th>When</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><Badge label={row.type_label} /></td>
                <td>{row.body}</td>
                <td>{row.created_by_name}</td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td><RowActions onView={() => setViewing(row)} viewTo={undefined} /></td>
              </tr>
            ))}
            {shown.length === 0 ? <EmptyRow colSpan={5}>No activity yet.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {creating ? (
        <RecordForm
          title="New activity"
          initial={{ activity_type: "note" }}
          fields={[
            { name: "lead", label: "Lead", type: "select", required: true, options: leads.map((lead) => ({ value: lead.id, label: `${lead.full_name} (${lead.reference})` })) },
            { name: "activity_type", label: "Type", type: "select", required: true, options: ACTIVITY_TYPES.map((item) => ({ value: item, label: item.replace("_", " ") })) },
            { name: "body", label: "What happened?", type: "textarea", required: true },
          ]}
          onSubmit={async (values) => {
            await api("/api/activities/", { method: "POST", body: JSON.stringify({ lead: Number(values.lead), activity_type: values.activity_type, body: values.body }) })
            setCreating(false)
            load()
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {viewing ? (
        <Modal title={viewing.type_label} onClose={() => setViewing(null)}>
          <p>{viewing.body}</p>
          <p className="muted">{viewing.created_by_name} · {new Date(viewing.created_at).toLocaleString()}</p>
        </Modal>
      ) : null}
    </>
  )
}

export function PipelinePage() {
  const [rows, setRows] = useState<{ id: number; number: string; client_name: string; status: string; total_amount: string; currency_code: string }[]>([])
  useEffect(() => {
    apiList<typeof rows[number]>("/api/quotations/?page_size=200").then(setRows)
  }, [])
  const columns = ["draft", "sent", "accepted", "declined"]
  return (
    <>
      <PageTitle title="Sales pipeline" lede="Quotations grouped by where they stand with the client." />
      <div className="columns">
        {columns.map((status) => (
          <div className="column" key={status}>
            <h3>{status}</h3>
            {rows.filter((row) => row.status === status).map((row) => (
              <Link className="mini" key={row.id} to={`/quotations/${row.id}`}>
                <strong>{row.number}</strong>
                <div>{row.client_name}</div>
                <div>{row.currency_code} {row.total_amount}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function OperationsPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<{ id: number; reference: string; client_name: string; start_date: string; end_date: string; safari_status: string; overall_status: string }[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  useEffect(() => {
    apiList<typeof rows[number]>("/api/bookings/?operations=1&page_size=200").then(setRows)
  }, [])
  const shown = rows.filter((row) => {
    const text = `${row.reference} ${row.client_name}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!status || row.safari_status === status)
  })
  return (
    <>
      <PageTitle title="Safari operations" lede="Active and confirmed files. Vehicles and guides are not part of this version." />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search booking or client"
        filters={
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Any safari status"
            options={[
              { value: "waiting_for_decisions", label: "Waiting for decisions" },
              { value: "waiting_for_safari", label: "Waiting for safari" },
              { value: "safari_in_progress", label: "Safari in progress" },
              { value: "safari_done", label: "Safari done" },
            ]}
          />
        }
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Booking</th><th>Client</th><th>Dates</th><th>Safari</th><th>File</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                <td>{row.client_name}</td>
                <td>{row.start_date} – {row.end_date}</td>
                <td><Badge value={row.safari_status} /></td>
                <td><Badge value={row.overall_status} /></td>
                <td><RowActions viewTo={`/bookings/${row.id}`} editTo={can("bookings.edit") ? `/bookings/${row.id}` : undefined} /></td>
              </tr>
            ))}
            {shown.length === 0 ? <EmptyRow colSpan={6}>No active or confirmed safaris.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
    </>
  )
}
