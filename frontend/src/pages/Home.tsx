import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { api, apiList } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Modal, MoneyCardAmounts, PageTitle } from "../ui"
import { EmptyRow, ListToolbar, ModuleStatusTabs, RecordForm, RowActions, useClientPagination, type ListFilterField, type ListStatusTab } from "../lists"
import { ModuleCard, type Tone } from "../cards"
import { IconBell, IconCalendar, IconCompass, IconDocument, IconReceipt, IconUser, IconUsers, IconWallet } from "../icons"

type Money = { currency: string; amount: string }
type DashboardData = {
  leads: number
  active_clients: number
  quotations: number
  confirmed_bookings: number
  completed_bookings: number
  upcoming_safaris: number
  open_invoices: number
  overdue_invoices: number
  follow_ups_due: number
  payments_received: Money[]
  outstanding: Money[]
  expenses: Money[]
  gross_profit: Money[]
}

type StatCard = { label: string; value: ReactNode; to: string; icon: ReactNode; tone: Tone; money?: boolean }

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
      .catch(() => {})
    apiList("/api/currencies/").then(setCurrencies).catch(() => setCurrencies([]))
  }, [])

  const cards: StatCard[] = data
    ? [
        { label: "Leads", value: data.leads, to: "/leads", icon: <IconUsers />, tone: "navy" },
        { label: "Active clients", value: data.active_clients, to: "/clients", icon: <IconUser />, tone: "teal" },
        { label: "Quotations", value: data.quotations, to: "/quotations", icon: <IconDocument />, tone: "orange" },
        { label: "Confirmed bookings", value: data.confirmed_bookings, to: "/bookings", icon: <IconCalendar />, tone: "green" },
        { label: "Completed bookings", value: data.completed_bookings, to: "/bookings?overall_status=completed", icon: <IconCalendar />, tone: "teal" },
        { label: "Upcoming safaris", value: data.upcoming_safaris, to: "/operations", icon: <IconCompass />, tone: "purple" },
        { label: "Follow-ups due", value: data.follow_ups_due, to: "/follow-ups", icon: <IconBell />, tone: "amber" },
        { label: "Open invoices", value: data.open_invoices, to: "/invoices", icon: <IconReceipt />, tone: "navy" },
        { label: "Overdue invoices", value: data.overdue_invoices, to: "/invoices", icon: <IconReceipt />, tone: "rose" },
        { label: "Payments received", value: <MoneyCardAmounts rows={data.payments_received} />, to: "/payments", icon: <IconWallet />, tone: "green", money: true },
        { label: "Outstanding", value: <MoneyCardAmounts rows={data.outstanding} />, to: "/invoices", icon: <IconWallet />, tone: "amber", money: true },
        { label: "Total expenses", value: <MoneyCardAmounts rows={data.expenses} />, to: "/expenses", icon: <IconWallet />, tone: "rose", money: true },
        { label: "Gross profit", value: <MoneyCardAmounts rows={data.gross_profit} />, to: "/profit", icon: <IconWallet />, tone: "teal", money: true },
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
          <ModuleCard key={card.label} to={card.to} icon={card.icon} tone={card.tone} label={card.label} value={card.value} valueVariant={card.money ? "money" : "default"} />
        ))}
      </div>
    </>
  )
}

type FollowUpRow = { kind: string; id: number; name: string; reference: string; date: string; state: string }
type FollowUpTarget = { id: number; full_name: string; reference: string }
type LeadOption = FollowUpTarget

const STATE_LABEL: Record<string, string> = { overdue: "Overdue", due: "Due today", upcoming: "Upcoming" }

const FOLLOWUP_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
]

const FOLLOWUP_FILTERS: ListFilterField[] = [
  { key: "kind", label: "Leads and clients", options: [{ value: "lead", label: "Leads" }, { value: "client", label: "Clients" }] },
]

export function FollowUpsPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [stateTab, setStateTab] = useState("")
  const [kind, setKind] = useState("")
  const [error, setError] = useState("")
  const [form, setForm] = useState<FollowUpRow | "new" | null>(null)
  const [leadTargets, setLeadTargets] = useState<FollowUpTarget[]>([])
  const [clientTargets, setClientTargets] = useState<FollowUpTarget[]>([])

  function load() {
    api<FollowUpRow[]>("/api/follow-ups/")
      .then((data) => { setRows(data); setError("") })
      .catch(() => {})
  }
  useEffect(() => {
    load()
    apiList<FollowUpTarget>("/api/leads/?page_size=200").then(setLeadTargets).catch(() => setLeadTargets([]))
    apiList<FollowUpTarget>("/api/clients/?page_size=200").then(setClientTargets).catch(() => setClientTargets([]))
  }, [])

  const shown = rows.filter((row) => (!stateTab || row.state === stateTab) && (!kind || row.kind === kind))
  const pag = useClientPagination(shown)
  const tabCounts = FOLLOWUP_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value ? rows.filter((row) => row.state === tab.value).length : rows.length
    return acc
  }, {})
  const path = (row: FollowUpRow) => `/api/${row.kind}s/${row.id}/`

  return (
    <>
      <PageTitle title="Follow-ups" lede="Leads and clients with a next date." />
      <Banner>{error}</Banner>
      <div className="list-screen no-print">
        <ModuleStatusTabs tabs={FOLLOWUP_TABS} active={stateTab} onChange={setStateTab} counts={tabCounts} />
        <ListToolbar
          page={pag.page}
          pageSize={pag.pageSize}
          total={pag.total}
          onPageChange={pag.setPage}
          filterFields={FOLLOWUP_FILTERS}
          filterValues={{ kind }}
          onFilterChange={(key, value) => { if (key === "kind") setKind(value) }}
          createLabel={can("leads.edit") ? "Add new" : undefined}
          onCreate={() => setForm("new")}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Timing</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {pag.rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.date}</td>
                <td><strong>{row.name}</strong></td>
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
            {pag.rows.length === 0 ? <EmptyRow colSpan={4}>No follow-ups scheduled.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {form ? (
        <RecordForm
          formKey={form === "new" ? "new" : `${form.kind}-${form.id}`}
          title={form === "new" ? "Schedule follow-up" : `Follow-up for ${form.name}`}
          initial={form === "new" ? {} : { date: form.date }}
          fields={
            form === "new"
              ? [
                  {
                    name: "target_id",
                    label: "Lead or client",
                    type: "select" as const,
                    required: true,
                    options: [
                      ...leadTargets.map((lead) => ({ value: `lead:${lead.id}`, label: `Lead · ${lead.full_name} (${lead.reference})` })),
                      ...clientTargets.map((client) => ({ value: `client:${client.id}`, label: `Client · ${client.full_name} (${client.reference})` })),
                    ],
                    empty: leadTargets.length || clientTargets.length ? "Choose" : "No leads or clients loaded",
                  },
                  { name: "date", label: "Follow-up date", type: "date", required: true },
                ]
              : [{ name: "date", label: "Follow-up date", type: "date", required: true }]
          }
          onSubmit={async (values) => {
            if (form === "new") {
              const [kind, rawId] = values.target_id.split(":")
              if (!kind || !rawId) throw new Error("Choose a lead or client.")
              await api(`/api/${kind}s/${rawId}/`, { method: "PATCH", body: JSON.stringify({ next_follow_up: values.date }) })
            } else {
              await api(path(form), { method: "PATCH", body: JSON.stringify({ next_follow_up: values.date }) })
            }
            setForm(null)
            load()
          }}
          successMessage="Follow-up saved successfully"
          onClose={() => setForm(null)}
        />
      ) : null}
    </>
  )
}

type ActivityRow = { id: number; type_label: string; activity_type: string; body: string; created_by_name: string; created_at: string; lead: number | null }

const ACTIVITY_TYPES = ["call", "email", "whatsapp", "meeting", "note", "follow_up", "other"]
const FILTER_TYPES = [...ACTIVITY_TYPES, "quotation"]

const ACTIVITY_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  ...FILTER_TYPES.map((item) => ({ value: item, label: item.replace("_", " ") })),
]

export function ActivitiesPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [typeTab, setTypeTab] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<ActivityRow | null>(null)
  const [leads, setLeads] = useState<LeadOption[]>([])

  function load() {
    apiList<ActivityRow>("/api/activities/?page_size=200").then(setRows).catch(() => {})
  }
  useEffect(() => {
    load()
    apiList<LeadOption>("/api/leads/?page_size=200").then(setLeads).catch(() => setLeads([]))
  }, [])

  const shown = rows.filter((row) => !typeTab || row.activity_type === typeTab)
  const pag = useClientPagination(shown)
  const tabCounts = ACTIVITY_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value ? rows.filter((row) => row.activity_type === tab.value).length : rows.length
    return acc
  }, {})

  return (
    <>
      <PageTitle title="Activities" lede="Calls, messages, quotations, and notes recorded by staff." />
      <Banner>{error}</Banner>
      <div className="list-screen no-print">
        <ModuleStatusTabs tabs={ACTIVITY_TABS} active={typeTab} onChange={setTypeTab} counts={tabCounts} />
        <ListToolbar
          page={pag.page}
          pageSize={pag.pageSize}
          total={pag.total}
          onPageChange={pag.setPage}
          createLabel={can("leads.create") ? "Add new" : undefined}
          onCreate={() => setCreating(true)}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>When</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {pag.rows.map((row) => (
              <tr key={row.id}>
                <td><Badge label={row.type_label} /></td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td><RowActions onView={() => setViewing(row)} viewTo={undefined} /></td>
              </tr>
            ))}
            {shown.length === 0 ? <EmptyRow colSpan={3}>No activity yet.</EmptyRow> : null}
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
          successMessage="Activity created successfully"
          onClose={() => setCreating(false)}
        />
      ) : null}
      {viewing ? (
        <Modal title={viewing.type_label} onClose={() => setViewing(null)}>
          <dl className="detail-list">
            <dt>When</dt><dd>{new Date(viewing.created_at).toLocaleString()}</dd>
            <dt>Staff</dt><dd>{viewing.created_by_name}</dd>
            <dt>Note</dt><dd>{viewing.body}</dd>
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="ghost" onClick={() => setViewing(null)}>Back</button>
          </div>
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

const OPS_TABS: ListStatusTab[] = [
  { value: "", label: "All" },
  { value: "waiting_for_decisions", label: "Waiting for decisions" },
  { value: "waiting_for_safari", label: "Waiting for safari" },
  { value: "safari_in_progress", label: "Safari in progress" },
  { value: "safari_done", label: "Safari done" },
]

export function OperationsPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState<{ id: number; reference: string; client_name: string; start_date: string; end_date: string; safari_status: string; overall_status: string }[]>([])
  const [statusTab, setStatusTab] = useState("")
  useEffect(() => {
    apiList<typeof rows[number]>("/api/bookings/?operations=1&page_size=200").then(setRows)
  }, [])
  const shown = rows.filter((row) => !statusTab || row.safari_status === statusTab)
  const pag = useClientPagination(shown)
  const tabCounts = OPS_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value ? rows.filter((row) => row.safari_status === tab.value).length : rows.length
    return acc
  }, {})
  return (
    <>
      <PageTitle title="Safari operations"/>
      <div className="list-screen no-print">
        <ModuleStatusTabs tabs={OPS_TABS} active={statusTab} onChange={setStatusTab} counts={tabCounts} />
        <ListToolbar page={pag.page} pageSize={pag.pageSize} total={pag.total} onPageChange={pag.setPage} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Booking</th><th>Client</th><th>Dates</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {pag.rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                <td>{row.client_name}</td>
                <td>{row.start_date} – {row.end_date}</td>
                <td><Badge value={row.safari_status} /></td>
                <td><RowActions viewTo={`/bookings/${row.id}`} editTo={can("bookings.edit") ? `/bookings/${row.id}` : undefined} /></td>
              </tr>
            ))}
            {pag.rows.length === 0 ? <EmptyRow colSpan={5}>No active or confirmed safaris.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
    </>
  )
}
