import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Field, money, PageTitle } from "../ui"
import { EmptyRow, FilterSelect, ListToolbar, RowActions, useList } from "../lists"

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

function blankStay(): Stay {
  return { vendor: "", hotel: "", check_in: "", check_out: "", room_type: "", rooms: 1, agreed_cost: "", cost_currency: "", due_date: "", confirmation_number: "", notes: "" }
}

export function BookingsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [safari, setSafari] = useState("")
  const { rows, loading, error, remove } = useList<Booking>("/api/bookings/", search, { overall_status: status })
  const shown = safari ? rows.filter((row) => row.safari_status === safari) : rows
  return (
    <>
      <PageTitle title="Bookings" lede="Each safari file keeps the fee, the hotels, and both payment statuses." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search reference, client or country"
        createLabel={can("bookings.create") ? "New booking" : undefined}
        createTo="/bookings/new"
        filters={
          <>
            <FilterSelect value={status} onChange={setStatus} label="All files" options={OVERALL.map(([value, label]) => ({ value, label }))} />
            <FilterSelect value={safari} onChange={setSafari} label="Any safari status" options={SAFARI.map(([value, label]) => ({ value, label }))} />
          </>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Reference</th><th>Client</th><th>Dates</th><th>Fee</th><th>Client</th><th>Hotels</th><th>File</th><th>Safari</th><th className="actions-col">Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                <td>{row.client_name}<div className="muted">{row.client_country}</div></td>
                <td>{row.start_date} – {row.end_date}<div className="muted">{row.safari_days} days</div></td>
                <td>{money(row.total_amount, row.currency_code)}</td>
                <td><Badge value={row.client_payment_status} /></td>
                <td><Badge value={row.vendor_payment_status} /></td>
                <td><Badge value={row.overall_status} /></td>
                <td><Badge value={row.safari_status} /></td>
                <td>
                  <RowActions
                    viewTo={`/bookings/${row.id}`}
                    editTo={can("bookings.edit") ? `/bookings/${row.id}` : undefined}
                    onDelete={can("bookings.delete") ? () => remove(row.id) : undefined}
                    deleteName={row.reference}
                  />
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 ? <EmptyRow colSpan={9}>No bookings match.</EmptyRow> : null}
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
  const [error, setError] = useState("")
  const [record, setRecord] = useState<Booking | null>(null)
  const [options, setOptions] = useState<{ currencies: Option[]; destinations: Option[]; types: Option[]; staff: Option[]; clients: Option[]; vendors: Option[] }>({ currencies: [], destinations: [], types: [], staff: [], clients: [], vendors: [] })
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
  const [quote, setQuote] = useState({ total_amount: "", validity_date: "", notes: "", terms: "" })
  const [invoiceForm, setInvoiceForm] = useState({ invoice_date: today(), due_date: "", payment_terms: "" })
  const [payment, setPayment] = useState({ paid_on: today(), amount: "", currency: "", amount_applied: "", payment_method: "", reference: "" })
  const [vendorPay, setVendorPay] = useState({ accommodation: "", paid_on: today(), amount: "", currency: "", payment_method: "", reference: "" })

  useEffect(() => {
    Promise.all([
      apiList<Option>("/api/currencies/"),
      apiList<Option>("/api/destinations/"),
      apiList<Option>("/api/safari-types/"),
      apiList<Option>("/api/staff/"),
      apiList<Option & { full_name: string }>("/api/clients/?page_size=200"),
      apiList<Option>("/api/vendors/?page_size=200"),
    ]).then(([currencies, destinations, types, staff, clients, vendors]) => {
      setOptions({ currencies, destinations, types, staff, clients, vendors })
    })
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
      setStays(data.accommodations.map((stay) => ({
        ...stay,
        vendor: stay.vendor,
        hotel: stay.hotel,
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
      accommodations: stays.map((stay) => ({
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
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      const saved = await api<Booking>(isNew ? "/api/bookings/" : `/api/bookings/${id}/`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(payload()),
      })
      if (isNew) navigate("/bookings")
      else loadBooking(String(saved.id))
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
  const hotelsFor = (vendorId: string | number) => options.vendors.find((vendor) => vendor.id === Number(vendorId))?.properties || []

  return (
    <form onSubmit={save}>
      <PageTitle
        title={record ? record.reference : "New booking"}
        lede={record ? `${record.client_name} · ${record.client_country || "Country on the client"} · ${record.safari_days} days` : "Opened from a lead, or from a client who is already on file."}
      >
        {can(isNew ? "bookings.create" : "bookings.edit") ? <button className="primary" type="submit">Save booking</button> : null}
      </PageTitle>
      <Banner>{error}</Banner>
      {record ? (
        <div className="stats">
          <div className="stat"><b>{money(record.total_amount, record.currency_code)}</b><span>Fee</span></div>
          <div className="stat"><b>{money(record.amount_paid, record.currency_code)}</b><span>Applied from the client</span></div>
          <div className="stat"><b>{money(record.balance, record.currency_code)}</b><span>Balance</span></div>
          <div className="stat"><Badge value={record.client_payment_status} /><div><Badge value={record.vendor_payment_status} /></div><span>Client, then hotels</span></div>
        </div>
      ) : null}
      <div className="card">
        <div className="form-grid">
          <Field label="Booking date"><input type="date" value={form.booking_date} onChange={(event) => setForm({ ...form, booking_date: event.target.value })} required /></Field>
          <Field label="Client">
            <select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}>
              <option value="">{form.lead ? "Create from the lead" : "Choose a client"}</option>
              {options.clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required /></Field>
          <Field label="End date"><input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} required /></Field>
          <Field label="Safari type">
            <select value={form.safari_type} onChange={(event) => setForm({ ...form, safari_type: event.target.value })}>
              <option value="">Not set</option>
              {options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Currency of the fee">
            <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} required>
              <option value="">Choose</option>
              {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          <Field label="Total fee"><input value={form.total_amount} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} required /></Field>
          <Field label="Consultant">
            <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
              <option value="">Unassigned</option>
              {options.staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </select>
          </Field>
          <Field label="Adults"><input type="number" min={0} value={form.adults} onChange={(event) => setForm({ ...form, adults: Number(event.target.value) })} /></Field>
          <Field label="Children"><input type="number" min={0} value={form.children} onChange={(event) => setForm({ ...form, children: Number(event.target.value) })} /></Field>
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
          <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        {datesLocked ? <p className="muted">Once the file is confirmed, safari status follows the travel dates.</p> : null}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="page-head">
          <h2>Accommodations</h2>
          <button type="button" onClick={() => setStays([...stays, blankStay()])}>Add stay</button>
        </div>
        <p className="muted">Each stay selects a hotel owner created under Vendors. The client does not see the hotel cost.</p>
        {stays.map((stay, index) => (
          <div className="stay form-grid" key={stay.id || index}>
            <Field label="Hotel owner">
              <select value={stay.vendor} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, vendor: event.target.value, hotel: "" } : item))}>
                <option value="">Choose</option>
                {options.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </Field>
            <Field label="Property">
              <select value={stay.hotel} onChange={(event) => setStays(stays.map((item, itemIndex) => itemIndex === index ? { ...item, hotel: event.target.value } : item))}>
                <option value="">Choose</option>
                {hotelsFor(stay.vendor).map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
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
        ))}
      </div>

      {record ? (
        <div className="grid-2" style={{ marginTop: 14 }}>
          <DocumentPanel
            record={record}
            can={can}
            quote={quote}
            setQuote={setQuote}
            invoiceForm={invoiceForm}
            setInvoiceForm={setInvoiceForm}
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
                <Field label="Stay" wide>
                  <select value={vendorPay.accommodation} onChange={(event) => setVendorPay({ ...vendorPay, accommodation: event.target.value })}>
                    <option value="">Choose a stay</option>
                    {record.accommodations.map((stay) => <option key={stay.id} value={stay.id}>{stay.property_name} · {stay.check_in}</option>)}
                  </select>
                </Field>
                <Field label="Date"><input type="date" value={vendorPay.paid_on} onChange={(event) => setVendorPay({ ...vendorPay, paid_on: event.target.value })} /></Field>
                <Field label="Amount"><input value={vendorPay.amount} onChange={(event) => setVendorPay({ ...vendorPay, amount: event.target.value })} /></Field>
                <Field label="Currency">
                  <select value={vendorPay.currency} onChange={(event) => setVendorPay({ ...vendorPay, currency: event.target.value })}>
                    <option value="">Choose</option>
                    {options.currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                onClick={() => run("/api/vendor-payments/", {
                  accommodation: Number(vendorPay.accommodation),
                  paid_on: vendorPay.paid_on,
                  amount: vendorPay.amount,
                  currency: Number(vendorPay.currency),
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
    </form>
  )
}

function DocumentPanel({
  record, can, quote, setQuote, invoiceForm, setInvoiceForm, payment, setPayment, methodsPath, run,
}: {
  record: Booking
  can: (code: string) => boolean
  quote: { total_amount: string; validity_date: string; notes: string; terms: string }
  setQuote: (value: { total_amount: string; validity_date: string; notes: string; terms: string }) => void
  invoiceForm: { invoice_date: string; due_date: string; payment_terms: string }
  setInvoiceForm: (value: { invoice_date: string; due_date: string; payment_terms: string }) => void
  payment: { paid_on: string; amount: string; currency: string; amount_applied: string; payment_method: string; reference: string }
  setPayment: (value: { paid_on: string; amount: string; currency: string; amount_applied: string; payment_method: string; reference: string }) => void
  methodsPath: string
  run: (path: string, body?: unknown) => Promise<void>
}) {
  const [methods, setMethods] = useState<Option[]>([])
  const [currencies, setCurrencies] = useState<Option[]>([])
  useEffect(() => {
    apiList<Option>(methodsPath).then(setMethods)
    apiList<Option>("/api/currencies/").then(setCurrencies)
  }, [methodsPath])
  return (
    <div className="card">
      <h2>Quotation, itinerary, invoice</h2>
      <p className="muted">The client sees the total fee, then the journey, then the invoice. Hotel costs stay inside the company.</p>
      {!record.quotation_id && can("quotations.create") ? (
        <div className="form-grid">
          <Field label="Quotation total"><input value={quote.total_amount} onChange={(event) => setQuote({ ...quote, total_amount: event.target.value })} /></Field>
          <Field label="Valid until"><input type="date" value={quote.validity_date} onChange={(event) => setQuote({ ...quote, validity_date: event.target.value })} /></Field>
          <Field label="Terms" wide><textarea value={quote.terms} onChange={(event) => setQuote({ ...quote, terms: event.target.value })} /></Field>
          <button type="button" onClick={() => run("/api/quotations/", { booking: record.id, total_amount: quote.total_amount || record.total_amount, currency: record.currency, validity_date: quote.validity_date || null, terms: quote.terms })}>Create quotation</button>
        </div>
      ) : null}
      {record.quotation_id ? (
        <p>
          <Link to={`/quotations/${record.quotation_id}`}>Open quotation</Link>
          {can("quotations.edit") ? (
            <span className="row" style={{ marginTop: 8 }}>
              <button type="button" onClick={() => run(`/api/quotations/${record.quotation_id}/send/`)}>Send</button>
              <button type="button" onClick={() => run(`/api/quotations/${record.quotation_id}/accept/`)}>Accept</button>
              <button type="button" onClick={() => run(`/api/quotations/${record.quotation_id}/decline/`)}>Decline</button>
            </span>
          ) : null}
        </p>
      ) : null}
      {!record.itinerary_id && can("itineraries.create") ? (
        <button type="button" onClick={() => run("/api/itineraries/", { booking: record.id, notes: "Journey prepared from the booking stays." })}>Create itinerary</button>
      ) : null}
      {record.itinerary_id ? (
        <p>
          <Link to={`/itineraries/${record.itinerary_id}`}>Open itinerary</Link>
          {can("itineraries.edit") ? <button type="button" onClick={() => run(`/api/itineraries/${record.itinerary_id}/send/`)}>Mark sent</button> : null}
        </p>
      ) : null}
      {!record.invoice_id && can("invoices.create") ? (
        <div className="form-grid">
          <Field label="Invoice date"><input type="date" value={invoiceForm.invoice_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })} /></Field>
          <Field label="Due date"><input type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })} /></Field>
          <button type="button" onClick={() => run("/api/invoices/", { booking: record.id, invoice_date: invoiceForm.invoice_date, due_date: invoiceForm.due_date, payment_terms: invoiceForm.payment_terms })}>Create invoice</button>
        </div>
      ) : null}
      {record.invoice_id && can("invoices.edit") ? <button type="button" onClick={() => run(`/api/invoices/${record.invoice_id}/send/`)}>Send invoice</button> : null}
      {record.invoice_id && can("payments.create") ? (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="Payment date"><input type="date" value={payment.paid_on} onChange={(event) => setPayment({ ...payment, paid_on: event.target.value })} /></Field>
          <Field label="Amount received"><input value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></Field>
          <Field label="Currency received">
            <select value={payment.currency} onChange={(event) => setPayment({ ...payment, currency: event.target.value })}>
              {currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          <Field label="Amount of the fee this covers"><input value={payment.amount_applied} onChange={(event) => setPayment({ ...payment, amount_applied: event.target.value })} placeholder="Same as amount if the currency matches the fee" /></Field>
          <Field label="Method">
            <select value={payment.payment_method} onChange={(event) => setPayment({ ...payment, payment_method: event.target.value })}>
              <option value="">Not set</option>
              {methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <button type="button" onClick={() => run("/api/payments/", {
            invoice: record.invoice_id,
            booking: record.id,
            paid_on: payment.paid_on,
            amount: payment.amount,
            currency: Number(payment.currency),
            amount_applied: payment.amount_applied || undefined,
            payment_method: emptyToNull(payment.payment_method),
            reference: payment.reference,
          })}>Record client payment</button>
        </div>
      ) : null}
    </div>
  )
}
