import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Field, money, PageTitle } from "../ui"
import { EmptyRow, ListToolbar, RowActions, useListScreen, type ListFilterField } from "../lists"
import { BOOKING_STATUS_TABS, monthFilterField } from "../listTabs"
import { ProcessFlow, type ProcessStep } from "../workflow"
import { useToast } from "../toast"

type VendorOption = { id: number; name: string; properties: { id: number; name: string }[] }
type Option = { id: number; name?: string; code?: string; full_name?: string; properties?: { id: number; name: string }[] }
type Stay = {
  id?: number
  vendor: string | number
  hotel: string | number
  check_in: string
  check_out: string
  room_type: string
  rooms: number
  agreed_cost: string
  cost_currency: string | number | null
  due_date: string
  confirmation_number: string
  notes: string
  vendor_name?: string
  property_name?: string
  nights?: number
  amount_paid?: string
  payment_status?: string
}
type Booking = {
  id: number
  reference: string
  booking_date: string
  client: number
  client_name: string
  client_country: string
  lead: number | null
  safari_type: number | null
  destination_ids: number[]
  destination_names: string[]
  start_date: string
  end_date: string
  safari_days: number
  adults: number
  children: number
  total_amount: string
  currency: number
  currency_code: string
  overall_status: string
  safari_status: string
  notes: string
  assigned_to: number | null
  accommodations: Stay[]
  client_payment_status: string
  vendor_payment_status: string
  amount_paid: string
  balance: string
  profit: null | {
    fee: { currency: string; amount: string }
    gross_profit: { currency: string; amount: string }
    unconverted_costs: { currency: string; amount: string }[]
  }
  quotation_id: number | null
  itinerary_id: number | null
  invoice_id: number | null
  travellers: Traveller[]
}

type Traveller = {
  id?: number
  full_name: string
  nationality: string
  date_of_birth: string
  passport_number: string
  passport_expiry: string
  gender: string
  dietary_requirements: string
  medical_notes: string
  emergency_contact: string
}

const OVERALL = [
  ["new", "New"],
  ["active", "Active"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
]
const SAFARI = [
  ["waiting_for_decisions", "Waiting for decisions"],
  ["waiting_for_safari", "Waiting for safari"],
  ["safari_in_progress", "Safari in progress"],
  ["safari_done", "Safari done"],
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function safariDays(start: string, end: string) {
  if (!start || !end) return 0
  const from = new Date(start)
  const to = new Date(end)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  return days > 0 ? days : 0
}

function bookingProcessSteps(record: Booking | null, leadId: string, isNew: boolean): ProcessStep[] {
  const lead = leadId || (record?.lead ? String(record.lead) : "")
  const hasFile = Boolean(record)
  return [
    { id: "lead", label: "Lead", to: lead ? `/leads/${lead}` : undefined, done: Boolean(lead), current: isNew && Boolean(lead) },
    {
      id: "client",
      label: "Client",
      to: record ? `/clients/${record.client}` : undefined,
      done: Boolean(record?.client || lead),
      current: false,
    },
    { id: "booking", label: "Booking file", done: hasFile, current: hasFile && !record?.quotation_id },
    {
      id: "quotation",
      label: "Quotation",
      to: record?.quotation_id ? `/quotations/${record.quotation_id}` : undefined,
      done: Boolean(record?.quotation_id),
      current: Boolean(record?.quotation_id) && !record?.itinerary_id,
    },
    {
      id: "itinerary",
      label: "Itinerary",
      to: record?.itinerary_id ? `/itineraries/${record.itinerary_id}` : undefined,
      done: Boolean(record?.itinerary_id),
      current: Boolean(record?.itinerary_id) && !record?.invoice_id,
    },
    {
      id: "invoice",
      label: "Invoice & payment",
      to: record?.invoice_id ? `/invoices/${record.invoice_id}` : undefined,
      done: Boolean(record?.invoice_id),
      current: Boolean(record?.invoice_id),
    },
    { id: "operations", label: "Operations", to: record ? "/operations" : undefined, done: record?.overall_status === "completed", current: false },
  ]
}

function blankStay(): Stay {
  return { vendor: "", hotel: "", check_in: "", check_out: "", room_type: "", rooms: 1, agreed_cost: "", cost_currency: "", due_date: "", confirmation_number: "", notes: "" }
}

function defaultHotelForVendor(vendors: VendorOption[], vendorId: string): string {
  if (!vendorId) return ""
  const vendor = vendors.find((item) => String(item.id) === vendorId)
  const properties = vendor?.properties ?? []
  return properties.length === 1 ? String(properties[0].id) : ""
}

function blankTraveller(): Traveller {
  return { full_name: "", nationality: "", date_of_birth: "", passport_number: "", passport_expiry: "", gender: "", dietary_requirements: "", medical_notes: "", emergency_contact: "" }
}

function bookingFilterFields(): ListFilterField[] {
  return [
    { key: "safari_status", label: "Any safari status", options: SAFARI.map(([value, label]) => ({ value, label })) },
    monthFilterField("Any start month"),
  ]
}

export function BookingsPage({ listPreset }: { listPreset?: "upcoming" | "in_progress" | "completed" }) {
  const { can } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  const presetStatus = params.get("overall_status") || ""
  const presetFilters = useMemo(() => {
    const filters: Record<string, string> = {}
    if (listPreset === "upcoming") filters.safari_status = "waiting_for_safari"
    if (listPreset === "in_progress") filters.safari_status = "safari_in_progress"
    if (listPreset === "completed") filters.safari_status = "safari_done"
    return filters
  }, [listPreset])
  const filterFields = useMemo(() => bookingFilterFields(), [])
  const screen = useListScreen<Booking>("/api/bookings/", {
    statusKey: "overall_status",
    statusTabs: BOOKING_STATUS_TABS,
    filterFields,
    dateKey: "start_date",
    screenKey: location.pathname,
    initialStatusTab: presetStatus,
    initialFilters: presetFilters,
  })
  const { rows, loading, error, remove } = screen
  return (
    <>
      <PageTitle
        title={listPreset === "upcoming" ? "Upcoming safaris" : listPreset === "in_progress" ? "Safaris in progress" : listPreset === "completed" ? "Completed safaris" : "Bookings"}
        lede="Each safari file keeps the fee, the hotels, and both payment statuses."
      />
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={BOOKING_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={filterFields}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("bookings.create") ? "Add new" : undefined}
        createTo="/bookings/new"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Booking</th><th>Client</th><th>Dates</th><th>Fee</th><th>Status</th><th className="actions-col">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                <td>{row.client_name}</td>
                <td>{row.start_date} – {row.end_date}</td>
                <td>{money(row.total_amount, row.currency_code)}</td>
                <td><Badge value={row.overall_status} /></td>
                <td>
                  <RowActions
                    viewTo={`/bookings/${row.id}`}
                    editTo={can("bookings.edit") ? `/bookings/${row.id}` : undefined}
                    onDelete={can("bookings.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={row.reference}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No bookings match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function BookingPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = id === "new"
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [error, setError] = useState("")
  const [record, setRecord] = useState<Booking | null>(null)
  const [options, setOptions] = useState<{ currencies: Option[]; destinations: Option[]; types: Option[]; staff: Option[]; clients: (Option & { full_name?: string; country?: string })[]; vendors: VendorOption[] }>({ currencies: [], destinations: [], types: [], staff: [], clients: [], vendors: [] })
  const [catalogError, setCatalogError] = useState("")
  const [form, setForm] = useState({
    booking_date: today(),
    client: params.get("client") || "",
    lead: params.get("lead") || "",
    safari_type: "",
    destination_ids: [] as number[],
    start_date: "",
    end_date: "",
    adults: 1,
    children: 0,
    total_amount: "",
    currency: "",
    overall_status: "new",
    safari_status: "waiting_for_decisions",
    notes: "",
    assigned_to: "",
  })
  const [stays, setStays] = useState<Stay[]>([])
  const [travellers, setTravellers] = useState<Traveller[]>([])
  const [quote, setQuote] = useState({ total_amount: "", validity_date: "", notes: "", terms: "" })
  const [payment, setPayment] = useState({ paid_on: today(), amount: "", currency: "", amount_applied: "", payment_method: "", reference: "" })
  const [vendorPay, setVendorPay] = useState({ accommodation: "", paid_on: today(), amount: "", payment_method: "", reference: "" })
  const [leadPreview, setLeadPreview] = useState<{ full_name: string; country: string } | null>(null)

  useEffect(() => {
    Promise.all([
      apiList<Option>("/api/currencies/"),
      apiList<Option>("/api/destinations/"),
      apiList<Option>("/api/safari-types/"),
      apiList<Option>("/api/staff/"),
      apiList<Option & { full_name: string; country?: string }>("/api/clients/?page_size=200"),
      apiList<VendorOption>("/api/vendors/?for_stays=1&status=active"),
    ]).then(([currencies, destinations, types, staff, clients, vendors]) => {
      setOptions({ currencies, destinations, types, staff, clients, vendors })
      setCatalogError("")
    }).catch((err: Error) => setCatalogError(err.message))
  }, [])

  function loadBooking(bookingId: string) {
    api<Booking>(`/api/bookings/${bookingId}/`).then((data) => {
      setRecord(data)
      setForm({
        booking_date: data.booking_date,
        client: String(data.client),
        lead: data.lead ? String(data.lead) : "",
        safari_type: data.safari_type ? String(data.safari_type) : "",
        destination_ids: data.destination_ids,
        start_date: data.start_date,
        end_date: data.end_date,
        adults: data.adults,
        children: data.children,
        total_amount: data.total_amount,
        currency: String(data.currency),
        overall_status: data.overall_status,
        safari_status: data.safari_status,
        notes: data.notes,
        assigned_to: data.assigned_to ? String(data.assigned_to) : "",
      })
      setTravellers((data.travellers || []).map((t) => ({
        ...t,
        date_of_birth: t.date_of_birth || "",
        passport_expiry: t.passport_expiry || "",
      })))
      setStays(data.accommodations.map((stay) => ({
        ...stay,
        vendor: stay.vendor ? String(stay.vendor) : "",
        hotel: stay.hotel ? String(stay.hotel) : "",
        due_date: stay.due_date || "",
        agreed_cost: stay.agreed_cost || "",
        cost_currency: stay.cost_currency || "",
      })))
      setQuote((current) => ({ ...current, total_amount: data.total_amount }))
      setPayment((current) => ({ ...current, currency: String(data.currency) }))
    }).catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    if (!isNew && id) loadBooking(id)
  }, [id, isNew])

  useEffect(() => {
    const leadId = params.get("lead")
    if (!isNew || !leadId) return
    api<{ full_name: string; country: string; adults: number; children: number; destination_ids: number[]; safari_type: number | null; budget: string | null; currency: number | null; assigned_to: number | null; travel_date: string | null }>(`/api/leads/${leadId}/`).then((lead) => {
      setLeadPreview({ full_name: lead.full_name, country: lead.country })
      setForm((current) => ({
        ...current,
        lead: leadId,
        adults: lead.adults || current.adults,
        children: lead.children,
        destination_ids: current.destination_ids.length ? current.destination_ids : lead.destination_ids,
        safari_type: current.safari_type || (lead.safari_type ? String(lead.safari_type) : ""),
        total_amount: current.total_amount || lead.budget || "",
        currency: current.currency || (lead.currency ? String(lead.currency) : ""),
        assigned_to: current.assigned_to || (lead.assigned_to ? String(lead.assigned_to) : ""),
        start_date: current.start_date || lead.travel_date || "",
      }))
    })
  }, [isNew, params])

  function completeStays() {
    return stays.filter((stay) => stay.vendor && stay.hotel && stay.check_in && stay.check_out)
  }

  function payload() {
    return {
      booking_date: form.booking_date,
      client: emptyToNull(form.client),
      lead: emptyToNull(form.lead),
      safari_type: emptyToNull(form.safari_type),
      destination_ids: form.destination_ids,
      start_date: form.start_date,
      end_date: form.end_date,
      adults: Number(form.adults),
      children: Number(form.children),
      total_amount: form.total_amount,
      currency: emptyToNull(form.currency),
      overall_status: form.overall_status,
      safari_status: form.safari_status,
      notes: form.notes,
      assigned_to: emptyToNull(form.assigned_to),
      accommodations: completeStays().map((stay) => ({
        id: stay.id,
        vendor: Number(stay.vendor),
        hotel: Number(stay.hotel),
        check_in: stay.check_in,
        check_out: stay.check_out,
        room_type: stay.room_type,
        rooms: Number(stay.rooms || 1),
        agreed_cost: stay.agreed_cost || "0",
        cost_currency: emptyToNull(stay.cost_currency),
        due_date: emptyToNull(stay.due_date),
        confirmation_number: stay.confirmation_number,
        notes: stay.notes,
      })),
      travellers: travellers.filter((t) => t.full_name.trim()).map((t) => ({
        id: t.id,
        full_name: t.full_name,
        nationality: t.nationality,
        date_of_birth: emptyToNull(t.date_of_birth),
        passport_number: t.passport_number,
        passport_expiry: emptyToNull(t.passport_expiry),
        gender: t.gender,
        dietary_requirements: t.dietary_requirements,
        medical_notes: t.medical_notes,
        emergency_contact: t.emergency_contact,
      })),
    }
  }

  function validateBooking() {
    if (!form.client && !form.lead) return "Choose a client or open the booking from a lead."
    if (!form.start_date || !form.end_date) return "Enter the safari start and end dates."
    if (!form.total_amount) return "Enter the safari fee."
    if (!form.currency) return "Choose the fee currency."
    const partial = stays.some((stay) => {
      const touched = stay.vendor || stay.hotel || stay.check_in || stay.check_out
      const complete = stay.vendor && stay.hotel && stay.check_in && stay.check_out
      return touched && !complete
    })
    if (partial) return "Each stay needs a vendor, lodge, check-in and check-out, or remove the empty row."
    return ""
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError("")
    const problem = validateBooking()
    if (problem) {
      setError(problem)
      return
    }
    try {
      await api<Booking>(isNew ? "/api/bookings/" : `/api/bookings/${id}/`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(payload()),
      })
      toast.success(isNew ? "Booking created successfully" : "Booking updated successfully")
      navigate("/bookings")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the booking")
    }
  }

  async function run(path: string, body?: unknown) {
    setError("")
    try {
      await api(path, { method: "POST", body: JSON.stringify(body || {}) })
      if (id) loadBooking(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That step failed")
    }
  }

  const datesLocked = record && (record.overall_status === "confirmed" || record.overall_status === "completed")
  const selectedClient = options.clients.find((client) => client.id === Number(form.client))
  const displayClientName = record?.client_name || leadPreview?.full_name || selectedClient?.full_name || (form.lead ? "Created from lead on save" : "")
  const displayCountry = record?.client_country || leadPreview?.country || selectedClient?.country || ""
  const displaySafariDays = record?.safari_days ?? safariDays(form.start_date, form.end_date)
  const processSteps = bookingProcessSteps(record, form.lead || params.get("lead") || "", isNew)

  return (
    <form onSubmit={save}>
      <PageTitle
        title={record ? record.reference : "New booking"}
        lede={record ? `${record.client_name} · ${record.client_country || "Country on the client"} · ${record.safari_days} days` : "Opened from a lead, or from a client who is already on file."}
        backTo="/bookings"
        backLabel="Bookings"
      />
      <Banner>{error}</Banner>
      <Banner>{catalogError}</Banner>
      {!catalogError && options.vendors.length === 0 ? (
        <p className="note">No vendors loaded. Add vendors under Operations → Vendors.</p>
      ) : null}
      <ProcessFlow title="Connected process (Lead → booking → quotation → invoice → operations)" steps={processSteps} />
      {record ? (
        <div className="stats">
          <div className="stat"><b>{money(record.total_amount, record.currency_code)}</b><span>Fee</span></div>
          <div className="stat"><b>{money(record.amount_paid, record.currency_code)}</b><span>Applied from the client</span></div>
          <div className="stat"><b>{money(record.balance, record.currency_code)}</b><span>Balance</span></div>
          <div className="stat"><Badge value={record.client_payment_status} /><div><Badge value={record.vendor_payment_status} /></div><span>Client, then hotels</span></div>
        </div>
      ) : null}
      <div className="card">
        <h3 className="form-section-title">Booking file</h3>
        <div className="form-grid">
          <Field label="Booking date"><input type="date" value={form.booking_date} onChange={(event) => setForm({ ...form, booking_date: event.target.value })} required /></Field>
          <Field label="Booking reference"><div className="readonly-field">{record?.reference || "Assigned when you save"}</div></Field>
          <Field label="Client name"><div className="readonly-field">{displayClientName || "—"}</div></Field>
          <Field label="Country"><div className="readonly-field">{displayCountry || "—"}</div></Field>
          <Field label="Link to client record">
            <select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}>
              <option value="">{form.lead ? "Create client from lead on save" : "Choose existing client"}</option>
              {options.clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
            </select>
          </Field>
        </div>
        <h3 className="form-section-title">Safari</h3>
        <div className="form-grid">
          <Field label="Safari type">
            <select value={form.safari_type} onChange={(event) => setForm({ ...form, safari_type: event.target.value })}>
              <option value="">Not set</option>
              {options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required /></Field>
          <Field label="End date"><input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} required /></Field>
          <Field label="Safari days"><div className="readonly-field">{displaySafariDays ? `${displaySafariDays} days` : "From start and end dates"}</div></Field>
          <Field label="Adults"><input type="number" min={0} value={form.adults} onChange={(event) => setForm({ ...form, adults: Number(event.target.value) })} /></Field>
          <Field label="Children"><input type="number" min={0} value={form.children} onChange={(event) => setForm({ ...form, children: Number(event.target.value) })} /></Field>
          <Field label="Locations" wide>
            <div className="checks">
              {options.destinations.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={form.destination_ids.includes(item.id)}
                    onChange={(event) => setForm({
                      ...form,
                      destination_ids: event.target.checked
                        ? [...form.destination_ids, item.id]
                        : form.destination_ids.filter((value) => value !== item.id),
                    })}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Consultant">
            <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
              <option value="">Unassigned</option>
              {options.staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </select>
          </Field>
        </div>
        <h3 className="form-section-title">Fees & payment status</h3>
        <div className="form-grid">
          <Field label="Total amount (selling price)"><input value={form.total_amount} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} required /></Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} required>
              <option value="">Choose</option>
              {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          {record ? (
            <>
              <Field label="Client payment status"><div className="readonly-field"><Badge value={record.client_payment_status} /></div></Field>
              <Field label="Vendor payment status (hotels)"><div className="readonly-field"><Badge value={record.vendor_payment_status} /></div></Field>
            </>
          ) : (
            <Field label="Payment status" wide><p className="muted" style={{ margin: 0 }}>Client and vendor payment status are calculated after you save the booking, add an invoice, and record payments.</p></Field>
          )}
        </div>
        <h3 className="form-section-title">Status</h3>
        <div className="form-grid">
          <Field label="Overall status">
            <select value={form.overall_status} onChange={(event) => setForm({ ...form, overall_status: event.target.value })}>
              {OVERALL.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Safari status">
            <select value={form.safari_status} disabled={Boolean(datesLocked)} onChange={(event) => setForm({ ...form, safari_status: event.target.value })}>
              {SAFARI.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        {datesLocked ? <p className="muted">Once the file is confirmed, safari status follows the travel dates.</p> : null}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="page-head">
          <h2>Travellers</h2>
          <button type="button" onClick={() => setTravellers([...travellers, blankTraveller()])}>Add traveller</button>
        </div>
        <p className="muted">Passport and medical details are visible to staff who can edit bookings.</p>
        {travellers.map((traveller, index) => (
          <div key={index} className="form-grid" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <Field label="Full name"><input value={traveller.full_name} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, full_name: e.target.value } : item))} required /></Field>
            <Field label="Nationality"><input value={traveller.nationality} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, nationality: e.target.value } : item))} /></Field>
            <Field label="Date of birth"><input type="date" value={traveller.date_of_birth} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, date_of_birth: e.target.value } : item))} /></Field>
            <Field label="Gender"><input value={traveller.gender} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, gender: e.target.value } : item))} /></Field>
            {can("bookings.edit") ? (
              <>
                <Field label="Passport number"><input value={traveller.passport_number} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, passport_number: e.target.value } : item))} /></Field>
                <Field label="Passport expiry"><input type="date" value={traveller.passport_expiry} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, passport_expiry: e.target.value } : item))} /></Field>
                <Field label="Dietary requirements" wide><input value={traveller.dietary_requirements} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, dietary_requirements: e.target.value } : item))} /></Field>
                <Field label="Medical / special notes" wide><textarea value={traveller.medical_notes} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, medical_notes: e.target.value } : item))} /></Field>
              </>
            ) : null}
            <Field label="Emergency contact" wide><input value={traveller.emergency_contact} onChange={(e) => setTravellers(travellers.map((item, i) => i === index ? { ...item, emergency_contact: e.target.value } : item))} /></Field>
            <div className="wide"><button type="button" onClick={() => setTravellers(travellers.filter((_, i) => i !== index))}>Remove traveller</button></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="page-head">
          <h2>Client stays</h2>
          <button type="button" onClick={() => setStays([...stays, blankStay()])}>Add stay</button>
        </div>
        <p className="muted">Where the client stays on safari. Choose the vendor, then their lodge (add vendors under Operations → Vendors). Lodge costs are internal only.</p>
        {stays.map((stay, index) => {
          const vendor = options.vendors.find((item) => String(item.id) === String(stay.vendor))
          const properties = vendor?.properties ?? []
          return (
          <div className="stay form-grid" key={stay.id || index}>
            <Field label="Vendor" wide>
              <select
                className="select-full"
                value={stay.vendor}
                onChange={(event) => {
                  const vendorId = event.target.value
                  const hotel = defaultHotelForVendor(options.vendors, vendorId)
                  setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, vendor: vendorId, hotel } : item))
                }}
              >
                <option value="">Choose vendor</option>
                {options.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Lodge / property" wide>
              <select
                className="select-full"
                value={stay.hotel}
                disabled={!stay.vendor}
                onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, hotel: event.target.value } : item))}
              >
                <option value="">{stay.vendor ? (properties.length ? "Choose lodge" : "No lodges on this vendor") : "Choose vendor first"}</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </Field>
            <Field label="Check-in"><input type="date" value={stay.check_in} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, check_in: event.target.value } : item))} required /></Field>
            <Field label="Check-out"><input type="date" value={stay.check_out} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, check_out: event.target.value } : item))} required /></Field>
            {can("costs.view") ? (
              <>
                <Field label="Agreed hotel cost"><input value={stay.agreed_cost} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, agreed_cost: event.target.value } : item))} /></Field>
                <Field label="Cost currency">
                  <select value={stay.cost_currency || ""} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, cost_currency: event.target.value } : item))}>
                    <option value="">Choose</option>
                    {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                  </select>
                </Field>
              </>
            ) : null}
            <Field label="Confirmation"><input value={stay.confirmation_number} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, confirmation_number: event.target.value } : item))} /></Field>
            <div className="actions"><button type="button" onClick={() => setStays(stays.filter((_, itemIndex) => itemIndex !== index))}>Remove stay</button></div>
          </div>
          )
        })}
      </div>

      {record ? (
        <div className="grid-2" style={{ marginTop: 14 }}>
          <DocumentPanel
            record={record}
            can={can}
            quote={quote}
            setQuote={setQuote}
            payment={payment}
            setPayment={setPayment}
            methodsPath="/api/payment-methods/"
            run={run}
          />
          {can("costs.create") ? (
            <div className="card">
              <h2>Pay a hotel</h2>
              <p className="muted">The company pays the vendor after the client has paid. This can be the other currency.</p>
              <div className="form-grid">
                <Field label="Hotel / lodge on this booking" wide>
                  <select
                    className="select-full"
                    value={vendorPay.accommodation}
                    onChange={(event) => setVendorPay({ ...vendorPay, accommodation: event.target.value })}
                  >
                    <option value="">{record.accommodations.length ? "Choose lodge and dates" : "Add hotels & lodges above and save the booking first"}</option>
                    {record.accommodations.filter((stay) => stay.id).map((stay) => (
                      <option key={stay.id} value={stay.id}>{stay.vendor_name}{stay.property_name ? ` · ${stay.property_name}` : ""} · {stay.check_in} – {stay.check_out}</option>
                    ))}
                  </select>
                </Field>
                <p className="wide muted">Vendor payment status on booking: <Badge value={record.vendor_payment_status} /></p>
                <Field label="Date"><input type="date" value={vendorPay.paid_on} onChange={(event) => setVendorPay({ ...vendorPay, paid_on: event.target.value })} /></Field>
                <Field label={`Amount paid (${record.currency_code} or stay cost currency)`}><input type="number" step="any" value={vendorPay.amount} onChange={(event) => setVendorPay({ ...vendorPay, amount: event.target.value })} /></Field>
                <Field label="Reference"><input value={vendorPay.reference} onChange={(event) => setVendorPay({ ...vendorPay, reference: event.target.value })} /></Field>
              </div>
              <button
                type="button"
                onClick={() => run("/api/vendor-payments/", {
                  accommodation: Number(vendorPay.accommodation),
                  paid_on: vendorPay.paid_on,
                  amount: vendorPay.amount,
                  payment_method: emptyToNull(vendorPay.payment_method),
                  reference: vendorPay.reference,
                })}
              >
                Record hotel payment
              </button>
            </div>
          ) : <div />}
          {record.profit ? (
            <div className="card">
              <h2>Profit</h2>
              <p>Fee {money(record.profit.fee.amount, record.profit.fee.currency)}</p>
              <p>Gross profit {money(record.profit.gross_profit.amount, record.profit.gross_profit.currency)}</p>
              {record.profit.unconverted_costs.length ? <p>Also spent, not converted: {record.profit.unconverted_costs.map((item) => money(item.amount, item.currency)).join(" · ")}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {can(isNew ? "bookings.create" : "bookings.edit") ? (
        <div className="form-footer no-print">
          <button className="primary" type="submit">Save booking</button>
          <Link className="button ghost" to="/bookings">Cancel</Link>
        </div>
      ) : null}
    </form>
  )
}

function DocumentPanel({
  record, can, quote, setQuote, payment, setPayment, methodsPath, run,
}: {
  record: Booking
  can: (code: string) => boolean
  quote: { total_amount: string; validity_date: string; notes: string; terms: string }
  setQuote: (value: { total_amount: string; validity_date: string; notes: string; terms: string }) => void
  payment: { paid_on: string; amount: string; currency: string; amount_applied: string; payment_method: string; reference: string }
  setPayment: (value: { paid_on: string; amount: string; currency: string; amount_applied: string; payment_method: string; reference: string }) => void
  methodsPath: string
  run: (path: string, body?: unknown) => Promise<void>
}) {
  const [methods, setMethods] = useState<Option[]>([])
  useEffect(() => {
    apiList<Option>(methodsPath).then(setMethods)
  }, [methodsPath])
  return (
    <div className="card">
      <h2>Quotation, itinerary, invoice</h2>
      <p className="muted">The client sees the total fee, then the journey, then the invoice. Hotel costs stay inside the company.</p>
      {record.quotation_id ? null : can("quotations.create") ? (
        <div className="form-grid">
          <Field label="Quotation total"><input value={quote.total_amount} onChange={(event) => setQuote({ ...quote, total_amount: event.target.value })} /></Field>
          <Field label="Valid until"><input type="date" value={quote.validity_date} onChange={(event) => setQuote({ ...quote, validity_date: event.target.value })} /></Field>
          <Field label="Terms" wide><textarea value={quote.terms} onChange={(event) => setQuote({ ...quote, terms: event.target.value })} /></Field>
          <div className="wide form-footer">
            <button
              type="button"
              className="primary"
              onClick={() =>
                run("/api/quotations/", {
                  booking: record.id,
                  total_amount: quote.total_amount || record.total_amount,
                  currency: record.currency,
                  validity_date: quote.validity_date || null,
                  terms: quote.terms,
                })
              }
            >
              Create quotation
            </button>
          </div>
        </div>
      ) : null}
      {record.quotation_id ? (
        <p>
          <Link className="button" to={`/quotations/${record.quotation_id}`}>Open quotation — send, accept, create itinerary</Link>
        </p>
      ) : null}
      {record.itinerary_id ? (
        <p>
          <Link className="button" to={`/itineraries/${record.itinerary_id}`}>Open itinerary — accept, create invoice</Link>
        </p>
      ) : null}
      {record.invoice_id ? (
        <p>
          <Link className="button primary" to={`/invoices/${record.invoice_id}`}>Open invoice — print or export for client</Link>
          {can("invoices.edit") ? <button type="button" className="button" style={{ marginLeft: 8 }} onClick={() => run(`/api/invoices/${record.invoice_id}/send/`)}>Mark invoice sent</button> : null}
        </p>
      ) : null}
      {record.invoice_id && can("payments.create") ? (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <p className="wide muted">Status on this booking: <Badge value={record.client_payment_status} /> · Balance {money(record.balance, record.currency_code)}</p>
          <Field label="Payment date"><input type="date" value={payment.paid_on} onChange={(event) => setPayment({ ...payment, paid_on: event.target.value })} /></Field>
          <Field label={`Amount paid (${record.currency_code})`}><input type="number" step="any" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></Field>
          <Field label="Method">
            <select value={payment.payment_method} onChange={(event) => setPayment({ ...payment, payment_method: event.target.value })}>
              <option value="">Not set</option>
              {methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></Field>
          <button type="button" onClick={() => run("/api/payments/", {
            invoice: record.invoice_id,
            paid_on: payment.paid_on,
            amount: payment.amount,
            payment_method: emptyToNull(payment.payment_method),
            reference: payment.reference,
          })}>Record client payment</button>
        </div>
      ) : null}
    </div>
  )
}
