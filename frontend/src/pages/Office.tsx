import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { DocumentCompanyLine } from "../company"
import { Badge, Banner, Field, money, Modal, PageTitle } from "../ui"
import { InvoiceDocument, ScreenToolbar, type InvoiceDoc } from "../documents"
import { exportInvoiceDocument, exportTable } from "../export"
import { DetailModal, EmptyRow, ListToolbar, RecordForm, RowActions, useClientPagination, useListScreen, type ListFilterField } from "../lists"
import { INVOICE_STATUS_TABS, ITINERARY_STATUS_TABS, QUOTATION_STATUS_TABS, VENDOR_STATUS_TABS, monthFilterField } from "../listTabs"
import { crudSuccessMessage, useToast } from "../toast"

type Row = Record<string, unknown> & { id: number }
type Choice = { value: string | number; label: string }

/** Loads the rows of a small reference list (bookings, currencies, ...) for form selects. */
function useChoices(path: string, label: (row: Row) => string, enabled = true) {
  const [rows, setRows] = useState<Row[]>([])
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled) return
    setLoadError("")
    setLoading(true)
    apiList<Row>(path)
      .then(setRows)
      .catch((err: Error) => {
        setRows([])
        setLoadError("")
      })
      .finally(() => setLoading(false))
  }, [path, enabled])
  const choices: Choice[] = useMemo(() => rows.map((row) => ({ value: row.id, label: label(row) })), [rows, label])
  return { rows, choices, loadError, loading }
}

function invoiceChoiceLabel(row: Row) {
  const status = String(row.status)
  const hint = status === "draft" ? " · send before paying" : ""
  return `${String(row.booking_reference)} · ${String(row.client_name)} · ${String(row.number)} · outstanding ${money(row.balance as string, String(row.currency_code))}${hint}`
}

function payableInvoice(row: Row) {
  if (String(row.status) === "cancelled") return false
  const balance = Number(row.balance)
  return Number.isFinite(balance) && balance > 0
}

function stayChoiceLabel(row: Row) {
  return `${String(row.booking_reference || row.booking)} · ${String(row.vendor_name || row.property_name)} · ${String(row.check_in)} – ${String(row.check_out || "")}`
}

const bookingLabel = (row: Row) => `${String(row.reference)} · ${String(row.client_name || "")}`
const codeLabel = (row: Row) => String(row.code || row.name)
const nameLabel = (row: Row) => String(row.name)

/* ------------------------------------------------------------ quotations */

const QUOTATION_FILTERS: ListFilterField[] = [monthFilterField()]

export function QuotationsPage() {
  const { can } = useAuth()
  const screen = useListScreen<Row>("/api/quotations/", {
    statusKey: "status",
    statusTabs: QUOTATION_STATUS_TABS,
    filterFields: QUOTATION_FILTERS,
    dateKey: "created_at",
  })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Quotations" lede="The fee sent to the client. Hotel costs are not on this document." />
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={QUOTATION_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={QUOTATION_FILTERS}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("quotations.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Quotation</th><th>Client</th><th>Fee</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/quotations/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td>{money(row.total_amount as string, String(row.currency_code))}</td>
                <td><Badge value={String(row.status)} label={String(row.status_label)} /></td>
                <td>
                  <RowActions
                    viewTo={`/quotations/${row.id}`}
                    onEdit={can("quotations.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("quotations.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No quotations match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RecordForm
          title={editing === "new" ? "New quotation" : `Edit ${String(editing.number)}`}
          initial={editing === "new" ? {} : { total_amount: editing.total_amount as string, validity_date: editing.validity_date as string, terms: editing.terms as string }}
          fields={[
            ...(editing === "new" ? [{ name: "booking", label: "Booking", type: "select" as const, required: true, options: bookings.choices }] : []),
            { name: "total_amount", label: "Total fee", type: "number", placeholder: editing === "new" ? "Leave empty to use the booking fee" : undefined },
            { name: "validity_date", label: "Valid until", type: "date" },
            { name: "terms", label: "Terms", type: "textarea" },
          ]}
          onSubmit={async (values) => {
            if (editing === "new") {
              const booking = bookings.rows.find((item) => String(item.id) === values.booking)
              await api("/api/quotations/", {
                method: "POST",
                body: JSON.stringify({
                  booking: Number(values.booking),
                  total_amount: values.total_amount || booking?.total_amount,
                  currency: booking?.currency,
                  validity_date: emptyToNull(values.validity_date),
                  terms: values.terms,
                }),
              })
            } else {
              await api(`/api/quotations/${editing.id}/`, {
                method: "PATCH",
                body: JSON.stringify({ total_amount: values.total_amount || undefined, validity_date: emptyToNull(values.validity_date), terms: values.terms }),
              })
            }
            setEditing(null)
            load()
          }}
          successMessage={crudSuccessMessage(editing === "new")}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

export function QuotationDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [row, setRow] = useState<Row | null>(null)
  const [booking, setBooking] = useState<Row | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function load() {
    api<Row>(`/api/quotations/${id}/`).then((quote) => {
      setRow(quote)
      if (quote.booking) {
        api<Row>(`/api/bookings/${quote.booking}/`).then(setBooking).catch(() => setBooking(null))
      } else {
        setBooking(null)
      }
    })
  }
  useEffect(() => { load() }, [id])

  async function run(path: string) {
    setBusy(true)
    setError("")
    try {
      await api(path, { method: "POST", body: "{}" })
      load()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function createItinerary() {
    if (!row) return
    setBusy(true)
    setError("")
    try {
      const itinerary = await api<{ id: number }>("/api/itineraries/", {
        method: "POST",
        body: JSON.stringify({ booking: row.booking, notes: "Prepared from the accepted quotation." }),
      })
      navigate(`/itineraries/${itinerary.id}`)
    } catch {
      // toasted
      setBusy(false)
    }
  }

  if (!row) return <p>Loading quotation…</p>
  const accepted = row.status === "accepted"
  const hasItinerary = Boolean(booking?.itinerary_id)

  return (
    <div className="page-document">
      <ScreenToolbar backTo="/quotations" backLabel="Quotations" onPrint={() => window.print()} />
      <Banner>{error}</Banner>
      <article className="sheet">
        <header>
          <div>
            <DocumentCompanyLine />
            <h2>Quotation {String(row.number)}</h2>
          </div>
        </header>
        <p>Client {String(row.client_name)}</p>
        <p>Booking {String(row.booking_reference)} · {String(row.start_date)} to {String(row.end_date)}</p>
        <p>Destinations {(row.destination_names as string[] | undefined)?.join(", ") || "—"}</p>
        <p><strong>Total fee {money(row.total_amount as string, String(row.currency_code))}</strong></p>
        <p>Valid until {String(row.validity_date || "—")}</p>
        <p>{String(row.terms || "")}</p>
        <p><Badge value={String(row.status)} label={String(row.status_label)} /></p>
        <p className="muted">This quotation states the safari fee. It does not show what the company pays the hotels.</p>
      </article>
      <div className="card workflow-steps no-print">
        <h2>Next step</h2>
        <ol className="workflow-list">
          <li className={accepted ? "done" : ""}>Client accepts the quotation</li>
          <li className={hasItinerary ? "done" : ""}>Create the itinerary</li>
          <li>Create the invoice and send it to the client</li>
        </ol>
        <div className="form-footer">
          {can("quotations.edit") && row.status !== "accepted" ? (
            <>
              {row.status !== "sent" && row.status !== "accepted" ? (
                <button type="button" className="button" disabled={busy} onClick={() => run(`/api/quotations/${row.id}/send/`)}>Send to client</button>
              ) : null}
              <button type="button" className="button primary" disabled={busy} onClick={() => run(`/api/quotations/${row.id}/accept/`)}>Mark accepted</button>
            </>
          ) : null}
          {accepted && !hasItinerary && can("itineraries.create") ? (
            <button type="button" className="primary" disabled={busy} onClick={createItinerary}>Create itinerary</button>
          ) : null}
          {hasItinerary ? <Link className="button primary" to={`/itineraries/${booking?.itinerary_id}`}>Open itinerary</Link> : null}
          <Link className="button ghost" to="/quotations">Back to list</Link>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- itineraries */

export function ItinerariesPage() {
  const { can } = useAuth()
  const screen = useListScreen<Row>("/api/itineraries/", {
    statusKey: "status",
    statusTabs: ITINERARY_STATUS_TABS,
    filterFields: [monthFilterField()],
    dateKey: "created_at",
  })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Itineraries" lede="Sent after the quotation is accepted." />
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={ITINERARY_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={[monthFilterField()]}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("itineraries.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Itinerary</th><th>Client</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/itineraries/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td><Badge value={String(row.status)} label={String(row.status_label)} /></td>
                <td>
                  <RowActions
                    viewTo={`/itineraries/${row.id}`}
                    onEdit={can("itineraries.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("itineraries.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4}>No itineraries match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RecordForm
          title={editing === "new" ? "New itinerary" : `Edit ${String(editing.number)}`}
          initial={editing === "new" ? {} : { notes: editing.notes as string }}
          note={editing === "new" ? "The booking needs an accepted quotation first." : undefined}
          fields={[
            ...(editing === "new" ? [{ name: "booking", label: "Booking", type: "select" as const, required: true, options: bookings.choices }] : []),
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
          onSubmit={async (values) => {
            if (editing === "new") await api("/api/itineraries/", { method: "POST", body: JSON.stringify({ booking: Number(values.booking), notes: values.notes }) })
            else await api(`/api/itineraries/${editing.id}/`, { method: "PATCH", body: JSON.stringify({ notes: values.notes }) })
            setEditing(null)
            load()
          }}
          successMessage={crudSuccessMessage(editing === "new")}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

export function ItineraryDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [row, setRow] = useState<Row | null>(null)
  const [booking, setBooking] = useState<Row | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [invoiceDates, setInvoiceDates] = useState({ invoice_date: new Date().toISOString().slice(0, 10), due_date: "" })

  function load() {
    api<Row>(`/api/itineraries/${id}/`).then((itinerary) => {
      setRow(itinerary)
      if (itinerary.booking) {
        api<Row>(`/api/bookings/${itinerary.booking}/`).then(setBooking).catch(() => setBooking(null))
      } else {
        setBooking(null)
      }
    })
  }
  useEffect(() => { load() }, [id])

  async function markSent() {
    setBusy(true)
    setError("")
    try {
      await api(`/api/itineraries/${id}/send/`, { method: "POST", body: "{}" })
      load()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function createInvoice() {
    if (!row) return
    setBusy(true)
    setError("")
    try {
      const invoice = await api<{ id: number }>("/api/invoices/", {
        method: "POST",
        body: JSON.stringify({
          booking: row.booking,
          invoice_date: invoiceDates.invoice_date,
          due_date: invoiceDates.due_date || invoiceDates.invoice_date,
        }),
      })
      navigate(`/invoices/${invoice.id}`)
    } catch {
      // toasted
      setBusy(false)
    }
  }

  if (!row) return <p>Loading itinerary…</p>
  const stays = (row.stays as { property: string; vendor: string; check_in: string; check_out: string; nights: number }[]) || []
  const sent = row.status === "sent"
  const hasInvoice = Boolean(booking?.invoice_id)

  return (
    <div className="page-document">
      <ScreenToolbar backTo="/itineraries" backLabel="Itineraries" onPrint={() => window.print()} />
      <Banner>{error}</Banner>
      <article className="sheet">
        <header>
          <div>
            <DocumentCompanyLine />
            <h2>Itinerary {String(row.number)}</h2>
          </div>
        </header>
        <p><Badge value={String(row.status)} label={String(row.status_label)} /></p>
        <p>{String(row.client_name)} · {String(row.booking_reference)}</p>
        <p>Journey {String(row.start_date)} to {String(row.end_date)} · {String(row.safari_days)} days</p>
        <p>Places {(row.destination_names as string[]).join(", ") || "—"}</p>
        {stays.map((stay) => (
          <p key={`${stay.property}-${stay.check_in}`}>{stay.check_in} – {stay.check_out} · {stay.property} ({stay.vendor}) · {stay.nights} nights</p>
        ))}
        <p><strong>Total {money(row.total_amount as string, String(row.currency_code))}</strong></p>
        <p>{String(row.notes || "")}</p>
      </article>
      <div className="card workflow-steps no-print">
        <h2>Next step</h2>
        <ol className="workflow-list">
          <li className={sent ? "done" : ""}>Client accepts the itinerary (mark sent)</li>
          <li className={hasInvoice ? "done" : ""}>Create the invoice</li>
          <li>Print or export the invoice for the client</li>
        </ol>
        {!sent && can("itineraries.edit") ? (
          <button type="button" className="button primary" disabled={busy} onClick={markSent}>Mark itinerary accepted / sent</button>
        ) : null}
        {sent && !hasInvoice && can("invoices.create") ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Invoice date"><input type="date" value={invoiceDates.invoice_date} onChange={(e) => setInvoiceDates({ ...invoiceDates, invoice_date: e.target.value })} /></Field>
            <Field label="Due date"><input type="date" value={invoiceDates.due_date} onChange={(e) => setInvoiceDates({ ...invoiceDates, due_date: e.target.value })} /></Field>
          </div>
        ) : null}
        <div className="form-footer">
          {sent && !hasInvoice && can("invoices.create") ? (
            <button type="button" className="primary" disabled={busy} onClick={createInvoice}>Create invoice</button>
          ) : null}
          {hasInvoice ? <Link className="button primary" to={`/invoices/${booking?.invoice_id}`}>Open invoice (print / export)</Link> : null}
          <Link className="button ghost" to="/itineraries">Back to list</Link>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- invoices */

const INVOICE_FILTERS: ListFilterField[] = [monthFilterField("Invoice month")]

export function InvoicesPage() {
  const { can } = useAuth()
  const screen = useListScreen<Row>("/api/invoices/", {
    statusKey: "status",
    statusTabs: INVOICE_STATUS_TABS,
    filterFields: INVOICE_FILTERS,
    dateKey: "invoice_date",
  })
  const { rows, loading, error, load, remove, allRows } = screen
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Invoices"/>
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={INVOICE_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={INVOICE_FILTERS}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("invoices.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
        onExport={(format) =>
          exportTable(format, "invoices", [
            { key: "number", label: "Invoice" },
            { key: "client_name", label: "Client" },
            { key: "booking_reference", label: "Booking" },
            { key: "total_amount", label: "Total" },
            { key: "balance", label: "Balance" },
            { key: "effective_status", label: "Status" },
          ], allRows as Record<string, unknown>[])}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Balance</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/invoices/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td>{money(row.balance as string, String(row.currency_code))}</td>
                <td><Badge value={String(row.effective_status)} /></td>
                <td>
                  <RowActions
                    viewTo={`/invoices/${row.id}`}
                    onEdit={can("invoices.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("invoices.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No invoices match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RecordForm
          title={editing === "new" ? "New invoice" : `Edit ${String(editing.number)}`}
          initial={editing === "new" ? { invoice_date: new Date().toISOString().slice(0, 10) } : { invoice_date: editing.invoice_date as string, due_date: editing.due_date as string, payment_terms: editing.payment_terms as string }}
          note={editing === "new" ? "The booking needs an itinerary and an accepted quotation first." : undefined}
          fields={[
            ...(editing === "new" ? [{ name: "booking", label: "Booking", type: "select" as const, required: true, options: bookings.choices }] : []),
            { name: "invoice_date", label: "Invoice date", type: "date", required: true },
            { name: "due_date", label: "Due date", type: "date", required: true },
            { name: "payment_terms", label: "Payment terms", type: "textarea" },
          ]}
          onSubmit={async (values) => {
            const body = { invoice_date: values.invoice_date, due_date: values.due_date, payment_terms: values.payment_terms }
            if (editing === "new") await api("/api/invoices/", { method: "POST", body: JSON.stringify({ ...body, booking: Number(values.booking) }) })
            else await api(`/api/invoices/${editing.id}/`, { method: "PATCH", body: JSON.stringify(body) })
            setEditing(null)
            load()
          }}
          successMessage={crudSuccessMessage(editing === "new")}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

type InvoiceRow = Row & { document?: InvoiceDoc }

export function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const [row, setRow] = useState<InvoiceRow | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    invoice_date: "",
    due_date: "",
    payment_terms: "",
    notes: "",
    line_title: "",
    line_description: "",
    quantity: "1",
    attention_to: "",
    contact_person: "",
  })

  function load() {
    api<InvoiceRow>(`/api/invoices/${id}/`)
      .then((data) => {
        setRow(data)
        setForm({
          invoice_date: String(data.invoice_date),
          due_date: String(data.due_date),
          payment_terms: String(data.payment_terms || ""),
          notes: String(data.notes || ""),
          line_title: String(data.line_title || ""),
          line_description: String(data.line_description || ""),
          quantity: String(data.quantity || 1),
          attention_to: String(data.attention_to || ""),
          contact_person: String(data.contact_person || ""),
        })
      })
      .catch(() => {})
  }
  useEffect(() => { load() }, [id])

  if (!row?.document) return error ? <Banner>{error}</Banner> : <p>Loading invoice…</p>
  const doc = row.document

  async function save() {
    setBusy(true)
    setError("")
    try {
      await api(`/api/invoices/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          invoice_date: form.invoice_date,
          due_date: form.due_date,
          payment_terms: form.payment_terms,
          notes: form.notes,
          line_title: form.line_title,
          line_description: form.line_description,
          quantity: Number(form.quantity) || 1,
          attention_to: form.attention_to,
          contact_person: form.contact_person,
        }),
      })
      toast.success("Invoice updated successfully")
      navigate("/invoices")
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-document">
      <ScreenToolbar
        backTo="/invoices"
        backLabel="Invoices"
        onPrint={() => window.print()}
        onExport={(format) => exportInvoiceDocument(format, doc as unknown as Record<string, unknown>, doc.number)}
      />
      <Banner>{error}</Banner>
      <InvoiceDocument doc={doc} />
      {can("invoices.edit") ? (
        <form
          className="card invoice-edit no-print"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <h2>Edit invoice details</h2>
          <p className="muted lede">These fields update what appears on the invoice and match what you entered when creating it.</p>
          <div className="form-grid">
            <Field label="Invoice date"><input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required /></Field>
            <Field label="Due date"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></Field>
            <Field label="Attention to"><input value={form.attention_to} onChange={(e) => setForm({ ...form, attention_to: e.target.value })} /></Field>
            <Field label="Contact person"><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Line title" wide><input value={form.line_title} onChange={(e) => setForm({ ...form, line_title: e.target.value })} /></Field>
            <Field label="Quantity"><input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
            <Field label="Line description" wide><textarea value={form.line_description} onChange={(e) => setForm({ ...form, line_description: e.target.value })} /></Field>
            <Field label="Payment terms" wide><textarea value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></Field>
            <Field label="Notes" wide><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="form-footer">
            <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <Link className="button ghost" to="/invoices">Cancel</Link>
          </div>
        </form>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- payments */

const CLIENT_PAY_LABELS: Record<string, string> = {
  not_paid: "Not paid",
  partial_paid: "Partial paid",
  fully_paid: "Fully paid",
}

function ClientPaymentModal({
  payment,
  invoiceRows,
  invoiceChoices,
  methods,
  loadingInvoices,
  onClose,
  onSaved,
}: {
  payment?: Row | null
  invoiceRows: Row[]
  invoiceChoices: Choice[]
  methods: Choice[]
  loadingInvoices: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = Boolean(payment)
  const [invoiceId, setInvoiceId] = useState(payment ? String(payment.invoice) : "")
  const [paidOn, setPaidOn] = useState(payment ? String(payment.paid_on) : new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "")
  const [method, setMethod] = useState(payment?.payment_method ? String(payment.payment_method) : "")
  const [reference, setReference] = useState(payment ? String(payment.reference || "") : "")
  const [notes, setNotes] = useState(payment ? String(payment.notes || "") : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const picked = invoiceRows.find((row) => String(row.id) === invoiceId)
  const currencyCode = editing
    ? String(payment?.currency_code || "")
    : picked ? String(picked.currency_code) : ""

  useEffect(() => {
    if (editing) return
    if (picked) setAmount(String(picked.balance ?? ""))
    else setAmount("")
  }, [invoiceId, editing])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const body = {
        paid_on: paidOn,
        amount,
        payment_method: emptyToNull(method),
        reference,
        notes,
      }
      if (editing && payment) {
        await api(`/api/payments/${payment.id}/`, { method: "PATCH", body: JSON.stringify(body) })
        toast.success("Payment updated successfully")
      } else {
        await api("/api/payments/", {
          method: "POST",
          body: JSON.stringify({ ...body, invoice: Number(invoiceId) }),
        })
        toast.success("Payment recorded successfully")
      }
      onSaved()
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? "Edit client payment" : "Record client payment"} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Banner>{error}</Banner>
        <p className="wide muted">
          Payment is recorded in the invoice currency. Client payment status (not paid / partial paid / fully paid) updates on the booking automatically.
        </p>
        {editing ? (
          <Field label="Invoice" wide>
            <div className="readonly-field">
              {String(payment?.invoice_number)} · {String(payment?.client_name)} · booking {String(payment?.booking_reference)}
            </div>
          </Field>
        ) : (
          <Field label="Booking / invoice" wide>
            <select className="select-full" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
              <option value="">{loadingInvoices ? "Loading…" : invoiceChoices.length ? "Choose booking invoice" : "No invoices with balance"}</option>
              {invoiceChoices.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
              ))}
            </select>
          </Field>
        )}
        {!editing && picked ? (
          <div className="wide readonly-field">
            <div><strong>{String(picked.client_name)}</strong> · {String(picked.booking_reference)}</div>
            <div>Invoice {String(picked.number)} · Selling price {money(picked.total_amount as string, String(picked.currency_code))}</div>
            <div>
              Status: <Badge value={String(picked.client_payment_status)} label={CLIENT_PAY_LABELS[String(picked.client_payment_status)] || String(picked.client_payment_status)} />
              {" · "}Outstanding {money(picked.balance as string, String(picked.currency_code))}
            </div>
          </div>
        ) : null}
        <Field label="Payment date"><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
        <Field label={currencyCode ? `Amount paid (${currencyCode})` : "Amount paid"}>
          <input type="number" step="any" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Not set</option>
            {methods.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref, receipt no." /></Field>
        <Field label="Notes" wide><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="form-footer wide">
          <button className="primary" type="submit" disabled={busy || (!editing && !invoiceId)}>{busy ? "Saving…" : editing ? "Save changes" : "Record payment"}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

export function PaymentsPage() {
  const { can } = useAuth()
  const currencies = useChoices("/api/currencies/", codeLabel)
  const paymentFilters = useMemo(
    () => [
      { key: "currency", label: "All currencies", options: currencies.choices },
      monthFilterField("Payment month"),
    ],
    [currencies.choices],
  )
  const screen = useListScreen<Row>("/api/payments/", { filterFields: paymentFilters, dateKey: "paid_on" })
  const { rows, loading, error, load, remove } = screen
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const methods = useChoices("/api/payment-methods/", nameLabel, true)
  const invoiceLoad = useChoices("/api/payments/invoice-options/", invoiceChoiceLabel, true)
  const invoiceChoices = useMemo(
    () => invoiceLoad.rows.filter(payableInvoice).map((row) => ({ value: row.id, label: invoiceChoiceLabel(row) })),
    [invoiceLoad.rows],
  )

  return (
    <>
      <PageTitle title="Client payments"/>
      <Banner>{error}</Banner>
      <Banner>{invoiceLoad.loadError}</Banner>
      {creating && !invoiceLoad.loading && invoiceChoices.length === 0 && !invoiceLoad.loadError ? (
        <p className="note">No invoices with an outstanding balance yet. Create an invoice from a booking itinerary first.</p>
      ) : null}
      <ListToolbar
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={paymentFilters}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("payments.create") ? "Add new" : undefined}
        onCreate={() => setCreating(true)}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Client</th><th>Amount</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.paid_on)}</td>
                <td>{String(row.client_name)}</td>
                <td>{money(row.amount as string, String(row.currency_code))}</td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("payments.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("payments.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={`the ${money(row.amount as string, String(row.currency_code))} payment from ${String(row.client_name)}`}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4}>No payments match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {viewing ? (
        <DetailModal
          title="Client payment"
          items={[
            ["Date", String(viewing.paid_on)],
            ["Client", String(viewing.client_name)],
            ["Booking", <Link to={`/bookings/${viewing.booking}`}>{String(viewing.booking_reference)}</Link>],
            ["Invoice", String(viewing.invoice_number || viewing.invoice)],
            ["Amount", money(viewing.amount as string, String(viewing.currency_code))],
            ["Method", String(viewing.method_name || "—")],
            ["Reference", String(viewing.reference || "—")],
            ["Notes", String(viewing.notes || "—")],
          ]}
          onClose={() => setViewing(null)}
          onEdit={can("payments.edit") ? () => { setEditing(viewing); setViewing(null) } : undefined}
        />
      ) : null}
      {creating ? (
        <ClientPaymentModal
          invoiceRows={invoiceLoad.rows}
          invoiceChoices={invoiceChoices}
          methods={methods.choices}
          loadingInvoices={invoiceLoad.loading}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load() }}
        />
      ) : null}
      {editing ? (
        <ClientPaymentModal
          payment={editing}
          invoiceRows={invoiceLoad.rows}
          invoiceChoices={invoiceChoices}
          methods={methods.choices}
          loadingInvoices={invoiceLoad.loading}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      ) : null}
    </>
  )
}

/* ----------------------------------------------------------- hotel payments */

const VENDOR_PAY_LABELS: Record<string, string> = {
  not_paid: "Not paid",
  partial_paid: "Partial paid",
  fully_paid: "Fully paid",
}

function HotelPaymentModal({
  editing,
  vendors,
  stayRows,
  methods,
  loadingVendors,
  loadingStays,
  vendorLoadError,
  stayLoadError,
  onClose,
  onSaved,
}: {
  editing: Row | null
  vendors: Choice[]
  stayRows: Row[]
  methods: Choice[]
  loadingVendors: boolean
  loadingStays: boolean
  vendorLoadError: string
  stayLoadError: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const isEdit = Boolean(editing)
  const [vendorId, setVendorId] = useState("")
  const [stayId, setStayId] = useState("")
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!editing) return
    setPaidOn(String(editing.paid_on || new Date().toISOString().slice(0, 10)))
    setAmount(String(editing.amount || ""))
    setMethod(editing.payment_method ? String(editing.payment_method) : "")
    setReference(String(editing.reference || ""))
    setStayId(String(editing.accommodation || ""))
    const stay = stayRows.find((row) => String(row.id) === String(editing.accommodation))
    setVendorId(stay ? String(stay.vendor) : "")
  }, [editing, stayRows])

  const staysForVendor = useMemo(
    () => (vendorId ? stayRows.filter((row) => String(row.vendor) === vendorId) : stayRows),
    [stayRows, vendorId],
  )
  const picked = stayRows.find((row) => String(row.id) === stayId)

  useEffect(() => {
    if (isEdit) return
    if (picked) setAmount(String(picked.amount_owed ?? ""))
    else setAmount("")
  }, [stayId, isEdit])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const body = {
        paid_on: paidOn,
        amount,
        payment_method: emptyToNull(method),
        reference,
      }
      if (isEdit && editing) {
        await api(`/api/vendor-payments/${editing.id}/`, { method: "PATCH", body: JSON.stringify(body) })
        toast.success("Hotel payment updated")
      } else {
        await api("/api/vendor-payments/", {
          method: "POST",
          body: JSON.stringify({ ...body, accommodation: Number(stayId) }),
        })
        toast.success("Hotel payment recorded successfully")
      }
      onSaved()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={isEdit ? "Edit hotel payment" : "Pay accommodation vendor"} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Banner>{error}</Banner>
        <Banner>{vendorLoadError}</Banner>
        <Banner>{stayLoadError}</Banner>
        <p className="wide muted">
          Choose the hotel/lodge, then which booking dates to pay for. Vendor payment status on the booking updates automatically (not paid / partial paid / fully paid).
        </p>
        <Field label="Hotel / lodge" wide>
          <select
            className="select-full"
            value={vendorId}
            onChange={(e) => { setVendorId(e.target.value); setStayId("") }}
            required
            disabled={isEdit}
          >
            <option value="">{loadingVendors ? "Loading…" : vendors.length ? "Choose vendor" : "No vendors — add under Operations → Vendors"}</option>
            {vendors.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Booking stay (dates)" wide>
          <select className="select-full" value={stayId} onChange={(e) => setStayId(e.target.value)} required disabled={isEdit || (!vendorId && staysForVendor.length === 0)}>
            <option value="">
              {loadingStays ? "Loading…" : !vendorId ? "Choose the lodge first" : staysForVendor.length ? "Choose booking dates" : "No bookings use this lodge yet — add it on a booking file"}
            </option>
            {staysForVendor.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {stayChoiceLabel(row)} · owed {money(row.amount_owed as string, String(row.cost_currency_code || ""))}
              </option>
            ))}
          </select>
        </Field>
        {picked ? (
          <div className="wide readonly-field">
            <div>
              <strong>{String(picked.vendor_name)}</strong>
              {picked.property_name ? ` · ${String(picked.property_name)}` : ""}
              {" · "}{String(picked.booking_reference)}
            </div>
            <div>
              Status: <Badge value={String(picked.vendor_payment_status)} label={VENDOR_PAY_LABELS[String(picked.vendor_payment_status)] || String(picked.vendor_payment_status)} />
              {" · "}Agreed {money(picked.agreed_cost as string, String(picked.cost_currency_code || ""))}
              {" · "}Owed {money(picked.amount_owed as string, String(picked.cost_currency_code || ""))}
            </div>
            <div>
              Bank {String(picked.bank_name || "—")}
              {picked.bank_account_name ? ` · ${String(picked.bank_account_name)}` : ""}
              {picked.bank_account_number ? ` · ${String(picked.bank_account_number)}` : ""}
              {picked.bank_swift ? ` · SWIFT ${String(picked.bank_swift)}` : ""}
              {picked.bank_iban ? ` · IBAN ${String(picked.bank_iban)}` : ""}
              {picked.bank_branch ? ` · ${String(picked.bank_branch)}` : ""}
            </div>
          </div>
        ) : null}
        <Field label="Payment date"><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
        <Field label={picked ? `Amount paid (${String(picked.cost_currency_code || "")})` : "Amount paid"}>
          <input type="number" step="any" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Not set</option>
            {methods.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref, receipt no." /></Field>
        <div className="form-footer wide">
          <button className="primary" type="submit" disabled={busy || (!isEdit && !stayId)}>{busy ? "Saving…" : isEdit ? "Save changes" : "Record hotel payment"}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

export function HotelPaymentsPage() {
  const { can } = useAuth()
  const screen = useListScreen<Row>("/api/vendor-payments/", {
    filterFields: [monthFilterField("Payment month")],
    dateKey: "paid_on",
  })
  const { rows, loading, error, load, remove } = screen
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const vendors = useChoices("/api/vendors/?for_stays=1&status=active", nameLabel, true)
  const methods = useChoices("/api/payment-methods/", nameLabel, true)
  const stays = useChoices("/api/vendor-payments/stay-options/", stayChoiceLabel, true)

  return (
    <>
      <PageTitle title="Hotel payments" />
      <Banner>{error}</Banner>
      <Banner>{vendors.loadError}</Banner>
      <Banner>{stays.loadError}</Banner>
      {creating && !vendors.loading && vendors.choices.length === 0 && !vendors.loadError ? (
        <p className="note">No vendors yet. Add them under Operations → Vendors, then assign stays on a booking.</p>
      ) : null}
      <ListToolbar
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={[monthFilterField("Payment month")]}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("costs.create") ? "Add new" : undefined}
        onCreate={() => setCreating(true)}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Booking</th><th>Hotel / lodge</th><th>Amount</th><th>Stay status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.paid_on)}</td>
                <td><Link to={`/bookings/${row.booking}`}>{String(row.booking_reference)}</Link></td>
                <td>{String(row.vendor_name || "—")}{row.property_name ? ` · ${String(row.property_name)}` : ""}</td>
                <td>{money(row.amount as string, String(row.currency_code))}</td>
                <td>
                  <Badge
                    value={String(row.stay_payment_status || "not_paid")}
                    label={VENDOR_PAY_LABELS[String(row.stay_payment_status)] || String(row.stay_payment_status)}
                  />
                </td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("costs.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("costs.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={`payment to ${String(row.property_name)}`}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No hotel payments match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {viewing ? (
        <DetailModal
          title="Hotel payment"
          items={[
            ["Date", String(viewing.paid_on)],
            ["Booking", <Link to={`/bookings/${viewing.booking}`}>{String(viewing.booking_reference)}</Link>],
            ["Hotel / lodge", String(viewing.vendor_name || viewing.property_name)],
            ["Property", String(viewing.property_name || "—")],
            ["Amount", money(viewing.amount as string, String(viewing.currency_code))],
            ["Method", String(viewing.method_name || "—")],
            ["Reference", String(viewing.reference || "—")],
            ["Notes", String(viewing.notes || "—")],
            ["Stay payment status", <Badge value={String(viewing.stay_payment_status || "not_paid")} label={VENDOR_PAY_LABELS[String(viewing.stay_payment_status)] || String(viewing.stay_payment_status)} />],
          ]}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {creating || editing ? (
        <HotelPaymentModal
          editing={editing}
          vendors={vendors.choices}
          stayRows={stays.rows}
          methods={methods.choices}
          loadingVendors={vendors.loading}
          loadingStays={stays.loading}
          vendorLoadError={vendors.loadError}
          stayLoadError={stays.loadError}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); load() }}
        />
      ) : null}
    </>
  )
}

/* ---------------------------------------------------------------- expenses */

export function ExpensesPage() {
  const { can } = useAuth()
  const categories = useChoices("/api/expense-categories/", nameLabel)
  const expenseFilters = useMemo(
    () => [
      { key: "category", label: "All categories", options: categories.choices },
      monthFilterField("Expense month"),
    ],
    [categories.choices],
  )
  const screen = useListScreen<Row>("/api/expenses/", { filterFields: expenseFilters, dateKey: "spent_on" })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const currencies = useChoices("/api/currencies/", codeLabel, editing !== null)
  const bookings = useChoices("/api/bookings/?page_size=200", (row) => String(row.reference), editing !== null)

  return (
    <>
      <PageTitle title="Expenses"/>
      <Banner>{error}</Banner>
      <ListToolbar
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={expenseFilters}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("expenses.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Expense</th><th>Amount</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.spent_on)}</td>
                <td>{String(row.description || row.category_name || "Expense")}</td>
                <td>{money(row.amount as string, String(row.currency_code))}</td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("expenses.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("expenses.delete") ? async () => { await remove(row.id) } : undefined}
                    deleteName={String(row.description || "this expense")}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4}>No expenses match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {viewing ? (
        <DetailModal
          title="Expense"
          items={[
            ["Date", String(viewing.spent_on)],
            ["Amount", money(viewing.amount as string, String(viewing.currency_code))],
            ["Category", String(viewing.category_name || "—")],
            ["Booking", viewing.booking_reference ? <Link to={`/bookings/${viewing.booking}`}>{String(viewing.booking_reference)}</Link> : "—"],
            ["Payment method", String(viewing.method_name || "—")],
            ["Description", String(viewing.description || "—")],
          ]}
          onClose={() => setViewing(null)}
          onEdit={can("expenses.edit") ? () => { setEditing(viewing); setViewing(null) } : undefined}
        />
      ) : null}
      {editing ? (
        <RecordForm
          title={editing === "new" ? "Record expense" : "Edit expense"}
          initial={editing === "new"
            ? { spent_on: new Date().toISOString().slice(0, 10) }
            : { spent_on: editing.spent_on as string, amount: editing.amount as string, currency: editing.currency as number, category: editing.category as number, booking: editing.booking as number, description: editing.description as string }}
          fields={[
            { name: "spent_on", label: "Date", type: "date", required: true },
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "currency", label: "Currency", type: "select", required: true, options: currencies.choices },
            { name: "category", label: "Category", type: "select", options: categories.choices, empty: "None" },
            { name: "booking", label: "Booking", type: "select", options: bookings.choices, empty: "Not linked" },
            { name: "description", label: "Description", type: "textarea" },
          ]}
          submitLabel={editing === "new" ? "Save expense" : "Save changes"}
          onSubmit={async (values) => {
            const body = JSON.stringify({
              spent_on: values.spent_on,
              amount: values.amount,
              currency: Number(values.currency),
              category: emptyToNull(values.category),
              booking: emptyToNull(values.booking),
              description: values.description,
            })
            if (editing === "new") await api("/api/expenses/", { method: "POST", body })
            else await api(`/api/expenses/${editing.id}/`, { method: "PATCH", body })
            setEditing(null)
            load()
          }}
          successMessage={crudSuccessMessage(editing === "new")}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

/* ---------------------------------------------------- cashbook & profit */

export function CashbookPage() {
  const [currencies, setCurrencies] = useState<Row[]>([])
  const [methods, setMethods] = useState<Row[]>([])
  const [currency, setCurrency] = useState("")
  const [method, setMethod] = useState("")
  const [data, setData] = useState<{ balances: Record<string, string>; books: Record<string, Row[]> } | null>(null)
  useEffect(() => {
    apiList<Row>("/api/currencies/").then(setCurrencies)
    apiList<Row>("/api/payment-methods/").then(setMethods)
  }, [])
  useEffect(() => {
    const query = new URLSearchParams()
    if (currency) query.set("currency", currency)
    if (method) query.set("method", method)
    api<{ balances: Record<string, string>; books: Record<string, Row[]> }>(`/api/cashbook/?${query.toString()}`).then(setData)
  }, [currency, method])
  const code = currency || Object.keys(data?.books || {})[0] || ""
  const allRows = code && data ? data.books[code] || [] : []
  const cashbookFilters = useMemo(
    () => [
      { key: "currency", label: "All currencies", options: currencies.map((item) => ({ value: String(item.code), label: String(item.code) })) },
      { key: "method", label: "All methods", options: methods.map((item) => ({ value: item.id, label: String(item.name) })) },
      monthFilterField("Movement month"),
    ],
    [currencies, methods],
  )
  const [month, setMonth] = useState("")
  const filteredRows = useMemo(
    () => allRows.filter((row) => !month || String(row.date).startsWith(month)),
    [allRows, month],
  )
  const pag = useClientPagination(filteredRows)
  return (
    <>
      <PageTitle title="Cashbook"/>
      <ListToolbar
        page={pag.page}
        pageSize={pag.pageSize}
        total={pag.total}
        onPageChange={pag.setPage}
        filterFields={cashbookFilters}
        filterValues={{ currency, method, month }}
        onFilterChange={(key, value) => {
          if (key === "currency") setCurrency(value)
          else if (key === "method") setMethod(value)
          else if (key === "month") setMonth(value)
        }}
      />
      {data ? <p>Balances: {Object.entries(data.balances).map(([key, value]) => money(value, key)).join(" · ") || "No movement yet"}</p> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>In</th><th>Out</th><th>Balance</th></tr></thead>
          <tbody>
            {pag.rows.map((row, index) => (
              <tr key={`${row.kind}-${row.id}-${index}`}>
                <td>{String(row.date)}</td>
                <td>{String(row.description)}<div className="muted">{String(row.booking || "")}</div></td>
                <td>{Number(row.money_in) ? money(row.money_in as string, code) : ""}</td>
                <td>{Number(row.money_out) ? money(row.money_out as string, code) : ""}</td>
                <td>{money(row.balance as string, code)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

type MoneyBucket = { currency: string; amount: string }

function sumMoneyBuckets(rows: Row[], field: string): MoneyBucket[] {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const bucket = row[field] as MoneyBucket | undefined
    if (!bucket?.currency) continue
    totals[bucket.currency] = (totals[bucket.currency] || 0) + Number(bucket.amount || 0)
  }
  return Object.entries(totals).map(([currency, amount]) => ({ currency, amount: String(amount) }))
}

function profitMarginPercent(selling: number, profit: number) {
  if (!selling || selling <= 0) return "—"
  return `${((profit / selling) * 100).toFixed(1)}%`
}

export function ProfitPage() {
  const [all, setAll] = useState<Row[]>([])
  const [detail, setDetail] = useState<Row | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")

  useEffect(() => { api<Row[]>("/api/profitability/").then(setAll).catch(() => setAll([])) }, [])

  const pag = useClientPagination(all)
  const revenue = sumMoneyBuckets(all, "selling_price")
  const costs = sumMoneyBuckets(all, "direct_costs")
  const gross = sumMoneyBuckets(all, "gross_profit")

  async function openDetail(row: Row) {
    setDetailLoading(true)
    setDetailError("")
    setDetail(null)
    try {
      const data = await api<Row>(`/api/profitability/${row.id}/`)
      setDetail(data)
    } catch {
      // toasted
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Profitability"
      />
      <div className="stats" style={{ marginBottom: 14 }}>
        <div className="stat"><b>{revenue.length ? revenue.map((r) => money(r.amount, r.currency)).join(" · ") : "—"}</b><span>Total selling price</span></div>
        <div className="stat"><b>{costs.length ? costs.map((r) => money(r.amount, r.currency)).join(" · ") : "—"}</b><span>Total direct costs</span></div>
        <div className="stat"><b>{gross.length ? gross.map((r) => money(r.amount, r.currency)).join(" · ") : "—"}</b><span>Total gross profit</span></div>
        <div className="stat">
          <b>
            {revenue.length === 1 && gross.length === 1 && revenue[0].currency === gross[0].currency
              ? profitMarginPercent(Number(revenue[0].amount), Number(gross[0].amount))
              : "—"}
          </b>
          <span>Margin (single currency)</span>
        </div>
      </div>
      <ListToolbar page={pag.page} pageSize={pag.pageSize} total={pag.total} onPageChange={pag.setPage} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Client</th>
              <th>Selling price</th>
              <th>Direct costs</th>
              <th>Gross profit</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pag.rows.map((row) => {
              const selling = row.selling_price as MoneyBucket
              const direct = row.direct_costs as MoneyBucket
              const profit = row.gross_profit as MoneyBucket
              return (
                <tr key={row.id}>
                  <td><Link to={`/bookings/${row.id}`}><strong>{String(row.reference)}</strong></Link></td>
                  <td>{String(row.client)}</td>
                  <td>{money(selling.amount, selling.currency)}</td>
                  <td>{money(direct.amount, direct.currency)}</td>
                  <td>{money(profit.amount, profit.currency)}</td>
                  <td>
                    <RowActions onView={() => openDetail(row)} />
                  </td>
                </tr>
              )
            })}
            {pag.rows.length === 0 ? <EmptyRow colSpan={6}>No bookings yet.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {detailLoading ? <p className="muted">Loading breakdown…</p> : null}
      <Banner>{detailError}</Banner>
      {detail ? (
        <Modal title={`Profitability · ${String(detail.reference)}`} onClose={() => setDetail(null)}>
          <dl className="detail-list">
            <dt>Client</dt><dd>{String(detail.client)}</dd>
            <dt>Travel dates</dt><dd>{String(detail.start_date)} – {String(detail.end_date)}</dd>
            <dt>Selling price</dt><dd>{money((detail.selling_price as MoneyBucket).amount, (detail.selling_price as MoneyBucket).currency)}</dd>
            <dt>Received from client</dt><dd>{money((detail.amount_received as MoneyBucket).amount, (detail.amount_received as MoneyBucket).currency)}</dd>
            <dt>Outstanding</dt><dd>{money((detail.outstanding as MoneyBucket).amount, (detail.outstanding as MoneyBucket).currency)}</dd>
          </dl>
          <h3 className="form-section-title">Direct cost breakdown</h3>
          <table className="compact-table">
            <thead><tr><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              {(detail.cost_breakdown as { category: string; amount: string }[] | undefined)?.map((line, index) => (
                <tr key={`${line.category}-${index}`}>
                  <td>{line.category}</td>
                  <td>{money(line.amount, (detail.selling_price as MoneyBucket).currency)}</td>
                </tr>
              )) || <tr><td colSpan={2}>No direct costs in the booking currency yet.</td></tr>}
              <tr>
                <td><strong>Total direct costs</strong></td>
                <td><strong>{money((detail.direct_costs as MoneyBucket).amount, (detail.direct_costs as MoneyBucket).currency)}</strong></td>
              </tr>
            </tbody>
          </table>
          <h3 className="form-section-title">Financial result</h3>
          <p><strong>Gross profit:</strong> {money((detail.gross_profit as MoneyBucket).amount, (detail.gross_profit as MoneyBucket).currency)}</p>
          {(detail.unconverted_costs as MoneyBucket[] | undefined)?.length ? (
            <p className="muted">Costs in other currencies (not in gross profit): {(detail.unconverted_costs as MoneyBucket[]).map((item) => money(item.amount, item.currency)).join(" · ")}</p>
          ) : null}
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="button" to={`/bookings/${detail.id}`}>Open booking</Link>
            <button type="button" className="ghost" onClick={() => setDetail(null)}>Close</button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

/* ----------------------------------------------------------------- vendors */

export function VendorsPage() {
  const { can } = useAuth()
  const screen = useListScreen<Row>("/api/vendors/", {
    statusKey: "status",
    statusTabs: VENDOR_STATUS_TABS,
    filterFields: [monthFilterField()],
    dateKey: "created_at",
  })
  const { rows, loading, error, load, remove } = screen
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)

  return (
    <>
      <PageTitle title="Vendors"/>
      <Banner>{error}</Banner>
      <ListToolbar
        statusTabs={VENDOR_STATUS_TABS}
        activeStatusTab={screen.statusTab}
        onStatusTabChange={screen.setStatusTab}
        tabCounts={screen.tabCounts}
        page={screen.page}
        pageSize={screen.pageSize}
        total={screen.total}
        onPageChange={screen.setPage}
        filterFields={[monthFilterField()]}
        filterValues={screen.filters}
        onFilterChange={screen.setFilter}
        createLabel={can("vendors.create") ? "Add new" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Vendor</th><th>Location</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((vendor) => (
              <tr key={vendor.id}>
                <td><strong>{String(vendor.name)}</strong></td>
                <td>{String(vendor.location || "—")}</td>
                <td><Badge value={String(vendor.status || "active")} /></td>
                <td>
                  <RowActions
                    onView={() => setViewing(vendor)}
                    onEdit={can("vendors.edit") ? () => setEditing(vendor) : undefined}
                    onDelete={can("vendors.delete") ? async () => { await remove(vendor.id) } : undefined}
                    deleteName={String(vendor.name)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4}>No vendors yet. Add a vendor, then assign their lodge on a booking.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RecordForm
          formKey={editing === "new" ? "new" : String(editing.id)}
          title={editing === "new" ? "New vendor" : "Edit vendor"}
          initial={editing === "new" ? {} : {
            name: editing.name as string,
            contact_person: editing.contact_person as string,
            phone: editing.phone as string,
            email: editing.email as string,
            location: editing.location as string,
            bank_account_name: editing.bank_account_name as string,
            bank_account_number: editing.bank_account_number as string,
            bank_name: editing.bank_name as string,
            bank_branch: editing.bank_branch as string,
            bank_swift: editing.bank_swift as string,
            bank_iban: editing.bank_iban as string,
          }}
          fields={[
            { name: "name", label: "Vendor name", required: true, wide: true },
            { name: "contact_person", label: "Contact" },
            { name: "phone", label: "Phone" },
            { name: "email", label: "Email", type: "email" },
            { name: "location", label: "Location / area" },
            { name: "bank_name", label: "Bank name" },
            { name: "bank_account_name", label: "Account name" },
            { name: "bank_account_number", label: "Account number" },
            { name: "bank_branch", label: "Branch" },
            { name: "bank_swift", label: "SWIFT / BIC" },
            { name: "bank_iban", label: "IBAN" },
          ]}
          onSubmit={async (values) => {
            const body: Record<string, unknown> = {
              name: values.name,
              contact_person: values.contact_person,
              phone: values.phone,
              email: values.email,
              location: values.location,
              bank_name: values.bank_name,
              bank_account_name: values.bank_account_name,
              bank_account_number: values.bank_account_number,
              bank_branch: values.bank_branch,
              bank_swift: values.bank_swift,
              bank_iban: values.bank_iban,
            }
            if (editing === "new") {
              await api("/api/vendors/", { method: "POST", body: JSON.stringify(body) })
            } else {
              await api(`/api/vendors/${editing.id}/`, { method: "PATCH", body: JSON.stringify(body) })
            }
            setEditing(null)
            load()
          }}
          successMessage={crudSuccessMessage(editing === "new")}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {viewing ? (
        <Modal title={String(viewing.name)} onClose={() => setViewing(null)}>
          <dl className="detail-list">
            <dt>Contact person</dt><dd>{String(viewing.contact_person || "—")}</dd>
            <dt>Phone</dt><dd>{String(viewing.phone || "—")}</dd>
            <dt>Email</dt><dd>{String(viewing.email || "—")}</dd>
            <dt>Location</dt><dd>{String(viewing.location || "—")}</dd>
            <dt>Bank</dt><dd>{String(viewing.bank_name || "—")}</dd>
            <dt>Account name</dt><dd>{String(viewing.bank_account_name || "—")}</dd>
            <dt>Account number</dt><dd>{String(viewing.bank_account_number || "—")}</dd>
            <dt>Branch</dt><dd>{String(viewing.bank_branch || "—")}</dd>
            <dt>SWIFT</dt><dd>{String(viewing.bank_swift || "—")}</dd>
            <dt>IBAN</dt><dd>{String(viewing.bank_iban || "—")}</dd>
            <dt>Status</dt><dd>{String(viewing.status || "active")}</dd>
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="ghost" onClick={() => setViewing(null)}>Back</button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
