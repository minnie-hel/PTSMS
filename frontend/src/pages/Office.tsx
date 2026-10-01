import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api, apiList, emptyToNull } from "../api"
import { useAuth } from "../auth"
import { DocumentCompanyLine } from "../company"
import { Badge, Banner, money, moneyList, Modal, PageTitle } from "../ui"
import { DetailModal, EmptyRow, FilterSelect, ListToolbar, RecordForm, RowActions, useList } from "../lists"

type Row = Record<string, unknown> & { id: number }
type Choice = { value: string | number; label: string }

/** Loads the rows of a small reference list (bookings, currencies, ...) for form selects. */
function useChoices(path: string, label: (row: Row) => string, enabled = true) {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    if (enabled) apiList<Row>(path).then(setRows).catch(() => setRows([]))
  }, [path, enabled])
  const choices: Choice[] = useMemo(() => rows.map((row) => ({ value: row.id, label: label(row) })), [rows])
  return { rows, choices }
}

const bookingLabel = (row: Row) => `${String(row.reference)} · ${String(row.client_name || "")}`
const codeLabel = (row: Row) => String(row.code || row.name)
const nameLabel = (row: Row) => String(row.name)

/* ------------------------------------------------------------ quotations */

export function QuotationsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/quotations/", search, { status })
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Quotations" lede="The fee sent to the client. Hotel costs are not on this document." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search number, client or booking"
        createLabel={can("quotations.create") ? "New quotation" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={status} onChange={setStatus} label="All statuses" options={["draft", "sent", "accepted", "declined"].map((item) => ({ value: item, label: item }))} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Number</th><th>Client</th><th>Booking</th><th>Fee</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/quotations/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td>{String(row.booking_reference)}</td>
                <td>{money(row.total_amount as string, String(row.currency_code))}</td>
                <td><Badge value={String(row.status)} label={String(row.status_label)} /></td>
                <td>
                  <RowActions
                    viewTo={`/quotations/${row.id}`}
                    onEdit={can("quotations.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("quotations.delete") ? () => remove(row.id) : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No quotations match.</EmptyRow> : null}
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
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

export function QuotationDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<Row | null>(null)
  useEffect(() => { api<Row>(`/api/quotations/${id}/`).then(setRow) }, [id])
  if (!row) return <p>Loading quotation…</p>
  return (
    <article className="sheet">
      <header>
        <div>
          <DocumentCompanyLine />
          <h2>Quotation {String(row.number)}</h2>
        </div>
        <button className="no-print" type="button" onClick={() => window.print()}>Print</button>
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
  )
}

/* ----------------------------------------------------------- itineraries */

export function ItinerariesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/itineraries/", search, { status })
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Itineraries" lede="Sent after the quotation is accepted." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search number, client or booking"
        createLabel={can("itineraries.create") ? "New itinerary" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={status} onChange={setStatus} label="All statuses" options={[{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }]} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Number</th><th>Client</th><th>Booking</th><th>Journey</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/itineraries/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td>{String(row.booking_reference)}</td>
                <td>{String(row.start_date)} – {String(row.end_date)}</td>
                <td><Badge value={String(row.status)} label={String(row.status_label)} /></td>
                <td>
                  <RowActions
                    viewTo={`/itineraries/${row.id}`}
                    onEdit={can("itineraries.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("itineraries.delete") ? () => remove(row.id) : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No itineraries match.</EmptyRow> : null}
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
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

export function ItineraryDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<Row | null>(null)
  useEffect(() => { api<Row>(`/api/itineraries/${id}/`).then(setRow) }, [id])
  if (!row) return <p>Loading itinerary…</p>
  const stays = (row.stays as { property: string; vendor: string; check_in: string; check_out: string; nights: number }[]) || []
  return (
    <article className="sheet">
      <header>
        <div>
          <DocumentCompanyLine />
          <h2>Itinerary {String(row.number)}</h2>
        </div>
        <button className="no-print" type="button" onClick={() => window.print()}>Print</button>
      </header>
      <p>{String(row.client_name)} · {String(row.booking_reference)}</p>
      <p>Journey {String(row.start_date)} to {String(row.end_date)} · {String(row.safari_days)} days</p>
      <p>Places {(row.destination_names as string[]).join(", ") || "—"}</p>
      {stays.map((stay) => (
        <p key={`${stay.property}-${stay.check_in}`}>{stay.check_in} – {stay.check_out} · {stay.property} ({stay.vendor}) · {stay.nights} nights</p>
      ))}
      <p><strong>Total {money(row.total_amount as string, String(row.currency_code))}</strong></p>
      <p>{String(row.notes || "")}</p>
    </article>
  )
}

/* ---------------------------------------------------------------- invoices */

export function InvoicesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/invoices/", search, { status })
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const bookings = useChoices("/api/bookings/?page_size=200", bookingLabel, editing === "new")

  return (
    <>
      <PageTitle title="Invoices" lede="Issued after the itinerary. No VAT." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search number, client or booking"
        createLabel={can("invoices.create") ? "New invoice" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={status} onChange={setStatus} label="All statuses" options={[{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "cancelled", label: "Cancelled" }]} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Booking</th><th>Total</th><th>Balance</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/invoices/${row.id}`}>{String(row.number)}</Link></td>
                <td>{String(row.client_name)}</td>
                <td>{String(row.booking_reference)}</td>
                <td>{money(row.total_amount as string, String(row.currency_code))}</td>
                <td>{money(row.balance as string, String(row.currency_code))}</td>
                <td><Badge value={String(row.effective_status)} /></td>
                <td>
                  <RowActions
                    viewTo={`/invoices/${row.id}`}
                    onEdit={can("invoices.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("invoices.delete") ? () => remove(row.id) : undefined}
                    deleteName={String(row.number)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={7}>No invoices match.</EmptyRow> : null}
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
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<Row | null>(null)
  useEffect(() => { api<Row>(`/api/invoices/${id}/`).then(setRow) }, [id])
  if (!row) return <p>Loading invoice…</p>
  return (
    <article className="sheet">
      <header>
        <div>
          <DocumentCompanyLine />
          <h2>Invoice {String(row.number)}</h2>
        </div>
        <button className="no-print" type="button" onClick={() => window.print()}>Print</button>
      </header>
      <p>{String(row.client_name)} · booking {String(row.booking_reference)}</p>
      <p>Date {String(row.invoice_date)} · due {String(row.due_date)}</p>
      <p>Total {money(row.total_amount as string, String(row.currency_code))}</p>
      <p>Paid {money(row.amount_paid as string, String(row.currency_code))} · balance {money(row.balance as string, String(row.currency_code))}</p>
      <p><Badge value={String(row.effective_status)} /></p>
      <p>{String(row.payment_terms || "")}</p>
    </article>
  )
}

/* ---------------------------------------------------------------- payments */

export function PaymentsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [currency, setCurrency] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/payments/", search, { currency })
  const [creating, setCreating] = useState(false)
  const currencies = useChoices("/api/currencies/", codeLabel)
  const methods = useChoices("/api/payment-methods/", nameLabel, creating)
  const invoices = useChoices("/api/invoices/?page_size=200&status=sent", (row) => `${String(row.number)} · ${String(row.client_name)} · balance ${money(row.balance as string, String(row.currency_code))}`, creating)

  return (
    <>
      <PageTitle title="Client payments" lede="Full or partial. The currency received can differ from the fee." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search client, booking or reference"
        createLabel={can("payments.create") ? "Record payment" : undefined}
        onCreate={() => setCreating(true)}
        filters={<FilterSelect value={currency} onChange={setCurrency} label="All currencies" options={currencies.choices} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Client</th><th>Booking</th><th>Received</th><th>Applied to fee</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.paid_on)}</td>
                <td>{String(row.client_name)}</td>
                <td>{String(row.booking_reference)}</td>
                <td>{money(row.amount as string, String(row.currency_code))}</td>
                <td>{String(row.amount_applied)}</td>
                <td>
                  <RowActions
                    viewTo={`/bookings/${row.booking}`}
                    onDelete={can("payments.delete") ? () => remove(row.id) : undefined}
                    deleteName={`the ${money(row.amount as string, String(row.currency_code))} payment from ${String(row.client_name)}`}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No payments match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {creating ? (
        <RecordForm
          title="Record payment"
          initial={{ paid_on: new Date().toISOString().slice(0, 10) }}
          note="Only sent invoices can receive payments."
          fields={[
            { name: "invoice", label: "Invoice", type: "select", required: true, options: invoices.choices, wide: true },
            { name: "paid_on", label: "Date", type: "date", required: true },
            { name: "amount", label: "Amount received", type: "number", required: true },
            { name: "currency", label: "Currency received", type: "select", required: true, options: currencies.choices },
            { name: "amount_applied", label: "Applied to the fee", type: "number", placeholder: "Only if the currency differs" },
            { name: "payment_method", label: "Method", type: "select", options: methods.choices },
            { name: "reference", label: "Reference" },
          ]}
          onSubmit={async (values) => {
            await api("/api/payments/", {
              method: "POST",
              body: JSON.stringify({
                invoice: Number(values.invoice),
                paid_on: values.paid_on,
                amount: values.amount,
                currency: Number(values.currency),
                amount_applied: emptyToNull(values.amount_applied) ?? undefined,
                payment_method: emptyToNull(values.payment_method),
                reference: values.reference,
              }),
            })
            setCreating(false)
            load()
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  )
}

/* ---------------------------------------------------------------- expenses */

export function ExpensesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/expenses/", search, { category })
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const categories = useChoices("/api/expense-categories/", nameLabel)
  const currencies = useChoices("/api/currencies/", codeLabel, editing !== null)
  const bookings = useChoices("/api/bookings/?page_size=200", (row) => String(row.reference), editing !== null)

  return (
    <>
      <PageTitle title="Expenses" lede="Costs the company covers besides the hotel payments recorded on a stay." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search description or booking"
        createLabel={can("expenses.create") ? "Record expense" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={category} onChange={setCategory} label="All categories" options={categories.choices} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Booking</th><th>Amount</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.spent_on)}</td>
                <td>{String(row.description || row.category_name || "Expense")}<div className="muted">{String(row.category_name || "")}</div></td>
                <td>{String(row.booking_reference || "—")}</td>
                <td>{money(row.amount as string, String(row.currency_code))}</td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("expenses.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("expenses.delete") ? () => remove(row.id) : undefined}
                    deleteName={String(row.description || "this expense")}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No expenses match.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {viewing ? (
        <DetailModal
          title="Expense"
          items={[
            ["Date", String(viewing.spent_on)],
            ["Amount", money(viewing.amount as string, String(viewing.currency_code))],
            ["Category", String(viewing.category_name || "")],
            ["Booking", String(viewing.booking_reference || "")],
            ["Description", String(viewing.description || "")],
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
  const [search, setSearch] = useState("")
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
  const rows = search ? allRows.filter((row) => `${String(row.description)} ${String(row.booking || "")}`.toLowerCase().includes(search.toLowerCase())) : allRows
  return (
    <>
      <PageTitle title="Cashbook" lede="TSH and USD each keep their own running balance. Filter by the way the money moved." />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search description or booking"
        filters={
          <>
            <FilterSelect value={currency} onChange={setCurrency} label="All currencies" options={currencies.map((item) => ({ value: String(item.code), label: String(item.code) }))} />
            <FilterSelect value={method} onChange={setMethod} label="All methods" options={methods.map((item) => ({ value: item.id, label: String(item.name) }))} />
          </>
        }
      />
      {data ? <p>Balances: {Object.entries(data.balances).map(([key, value]) => money(value, key)).join(" · ") || "No movement yet"}</p> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>In</th><th>Out</th><th>Balance</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
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

export function ProfitPage() {
  const [all, setAll] = useState<Row[]>([])
  const [search, setSearch] = useState("")
  useEffect(() => { api<Row[]>("/api/profitability/").then(setAll) }, [])
  const rows = search ? all.filter((row) => `${String(row.reference)} ${String(row.client)}`.toLowerCase().includes(search.toLowerCase())) : all
  return (
    <>
      <PageTitle title="Profitability" lede="Fee minus hotel costs and expenses in the same currency." />
      <ListToolbar search={search} onSearch={setSearch} placeholder="Search booking or client" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Booking</th><th>Client</th><th>Fee</th><th>Gross profit</th><th>Other currency costs</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const profit = row.gross_profit as { currency: string; amount: string }
              const fee = row.fee as { currency: string; amount: string }
              const other = row.unconverted_costs as { currency: string; amount: string }[]
              return (
                <tr key={row.id}>
                  <td><Link to={`/bookings/${row.id}`}>{String(row.reference)}</Link></td>
                  <td>{String(row.client)}</td>
                  <td>{money(fee.amount, fee.currency)}</td>
                  <td>{money(profit.amount, profit.currency)}</td>
                  <td>{moneyList(other)}</td>
                  <td><RowActions viewTo={`/bookings/${row.id}`} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ----------------------------------------------------------------- vendors */

export function VendorsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<Row>("/api/vendors/", search, { status })
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)

  return (
    <>
      <PageTitle title="Accommodation vendors" lede="Hotels and lodges only — each vendor owns properties you pick on every stay." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, contact or location"
        createLabel={can("vendors.create") ? "New vendor" : undefined}
        onCreate={() => setEditing("new")}
        filters={<FilterSelect value={status} onChange={setStatus} label="All statuses" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />}
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Vendor</th><th>Contact</th><th>Properties</th><th>Still owed</th><th className="actions-col">Actions</th></tr></thead>
          <tbody>
            {rows.map((vendor) => (
              <tr key={vendor.id}>
                <td><strong>{String(vendor.name)}</strong><div className="muted">{String(vendor.location || "")}</div></td>
                <td>{String(vendor.contact_person || "—")}<div className="muted">{String(vendor.phone || "")}</div></td>
                <td>{((vendor.properties as { name: string }[]) || []).map((item) => item.name).join(", ") || "None yet"}</td>
                <td>{moneyList(vendor.owed as { currency: string; amount: string }[])}</td>
                <td>
                  <RowActions
                    onView={() => setViewing(vendor)}
                    onEdit={can("vendors.edit") ? () => setEditing(vendor) : undefined}
                    onDelete={can("vendors.delete") ? () => remove(vendor.id) : undefined}
                    deleteName={String(vendor.name)}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No accommodation vendors match. Add one before you put stays on a booking.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RecordForm
          title={editing === "new" ? "New accommodation vendor" : "Edit vendor"}
          initial={editing === "new" ? {} : { name: editing.name as string, contact_person: editing.contact_person as string, phone: editing.phone as string, email: editing.email as string, location: editing.location as string }}
          fields={[
            { name: "name", label: "Lodging / hotel name", required: true, wide: true },
            { name: "contact_person", label: "Contact" },
            { name: "phone", label: "Phone" },
            { name: "email", label: "Email", type: "email" },
            { name: "location", label: "Location" },
            ...(editing === "new" ? [{ name: "first_property", label: "First property", wide: true }] : []),
          ]}
          onSubmit={async (values) => {
            const body: Record<string, unknown> = {
              name: values.name,
              contact_person: values.contact_person,
              phone: values.phone,
              email: values.email,
              location: values.location,
            }
            if (editing === "new") {
              body.properties = values.first_property ? [{ name: values.first_property, location: values.location }] : []
              await api("/api/vendors/", { method: "POST", body: JSON.stringify(body) })
            } else {
              await api(`/api/vendors/${editing.id}/`, { method: "PATCH", body: JSON.stringify(body) })
            }
            setEditing(null)
            load()
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {viewing ? (
        <Modal title={String(viewing.name)} onClose={() => setViewing(null)}>
          <dl className="detail-list">
            <dt>Contact</dt><dd>{String(viewing.contact_person || "—")}</dd>
            <dt>Phone</dt><dd>{String(viewing.phone || "—")}</dd>
            <dt>Email</dt><dd>{String(viewing.email || "—")}</dd>
            <dt>Location</dt><dd>{String(viewing.location || "—")}</dd>
            <dt>Properties</dt><dd>{((viewing.properties as { name: string }[]) || []).map((item) => item.name).join(", ") || "None yet"}</dd>
            <dt>Still owed</dt><dd>{moneyList(viewing.owed as { currency: string; amount: string }[])}</dd>
          </dl>
        </Modal>
      ) : null}
    </>
  )
}
