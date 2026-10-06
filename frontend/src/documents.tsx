import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import type { ExportFormat } from "./export"
import { IconArrowRight } from "./icons"

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf", label: "PDF (print)" },
  { id: "xlsx", label: "Excel (.xlsx)" },
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
]

/** Print and export controls sit at the top of list and document screens. */
export function ScreenToolbar({
  backTo,
  backLabel = "Back",
  search,
  onSearch,
  searchPlaceholder,
  onPrint,
  onExport,
  extra,
}: {
  backTo?: string
  backLabel?: string
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  onPrint?: () => void
  onExport?: (format: ExportFormat) => void
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div className="screen-toolbar no-print">
      <div className="screen-toolbar-start">
        {backTo ? <Link className="button ghost" to={backTo}>← {backLabel}</Link> : null}
        {onSearch ? (
          <label className="search-box screen-search">
            <input
              value={search ?? ""}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={searchPlaceholder || "Search"}
            />
          </label>
        ) : null}
      </div>
      <div className="screen-toolbar-end">
        {extra}
        {onPrint ? <button type="button" className="button" onClick={onPrint}>Print</button> : null}
        {onExport ? (
          <div className="export-menu" ref={menuRef}>
            <button type="button" className="button primary" onClick={() => setOpen((value) => !value)}>
              Export <IconArrowRight />
            </button>
            {open ? (
              <div className="export-panel">
                {FORMATS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onExport(item.id)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type InvoiceDoc = {
  number: string
  invoice_date: string
  due_date: string
  paid_badge: string
  client_name: string
  attention_to: string
  contact_person: string
  consultant_name: string
  line_title: string
  line_description: string
  quantity: number
  rate_display: string
  total_display: string
  amount_paid_display: string
  balance_display: string
  total_in_words: string
  payment_terms: string
  notes: string
  currency_code: string
  company: {
    name: string
    email: string
    phone: string
    address: string
    tin_number: string
    logo_url: string
    bank_account_name: string
    bank_account_number: string
    bank_iban: string
    bank_swift: string
    bank_name: string
    bank_branch: string
    bank_branch_code: string
    bank_correspondent: string
    bank_correspondent_swift: string
    banks?: {
      currency_code: string
      account_name: string
      account_number: string
      iban: string
      swift: string
      bank_name: string
      branch: string
      branch_code: string
      correspondent: string
      correspondent_swift: string
    }[]
    invoice_terms: string
    invoice_footer: string
  }
  client: {
    full_name: string
    email: string
    phone: string
    country: string
    city: string
    address: string
  }
  payments: { date: string; mode: string; amount_display: string; account: string; reference: string }[]
}

export function InvoiceDocument({ doc }: { doc: InvoiceDoc }) {
  const terms = (doc.company.invoice_terms || "").split("\n").filter(Boolean)
  return (
    <article className="invoice-doc" id="invoice-print-root">
      <header className="inv-head">
        <div className="inv-head-left">
          <h1 className="inv-title">
            Invoice For {doc.client_name}
            {doc.paid_badge ? <span className="inv-badge paid">{doc.paid_badge}</span> : null}
          </h1>
          <dl className="inv-meta">
            <div><dt>Invoice No #</dt><dd>{doc.number}</dd></div>
            <div><dt>Invoice Date</dt><dd>{doc.invoice_date}</dd></div>
            <div><dt>Due Date</dt><dd>{doc.due_date}</dd></div>
            <div><dt>Travel Consultant</dt><dd>{doc.consultant_name || "—"}</dd></div>
            <div><dt>Contact Person</dt><dd>{doc.contact_person}</dd></div>
            <div><dt>Attention To</dt><dd>{doc.attention_to}</dd></div>
          </dl>
        </div>
        {doc.company.logo_url ? <img className="inv-logo" src={doc.company.logo_url} alt="" /> : null}
      </header>

      <div className="inv-boxes">
        <section className="inv-box">
          <h2>Billed By</h2>
          <p className="inv-strong">{doc.company.name}</p>
          <p>{doc.company.address}</p>
          {doc.company.tin_number ? <p>Tin Number: {doc.company.tin_number}</p> : null}
          <p>{doc.company.email}</p>
          <p>{doc.company.phone}</p>
        </section>
        <section className="inv-box">
          <h2>Billed To</h2>
          <p className="inv-strong">{doc.client.full_name}</p>
          <p>{[doc.client.address, doc.client.city, doc.client.country].filter(Boolean).join(", ")}</p>
          {doc.client.email ? <p>{doc.client.email}</p> : null}
          {doc.client.phone ? <p>{doc.client.phone}</p> : null}
        </section>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <strong className="inv-line-title">{doc.line_title}</strong>
              <p className="inv-line-desc">{doc.line_description}</p>
            </td>
            <td>{doc.quantity}</td>
            <td>{doc.rate_display}</td>
            <td>{doc.total_display}</td>
          </tr>
        </tbody>
      </table>

      <div className="inv-totals">
        <p className="inv-words"><span>Total (in words)</span> {doc.total_in_words}</p>
        <table className="inv-sum">
          <tbody>
            <tr><td>Total ({doc.currency_code})</td><td>{doc.total_display}</td></tr>
            <tr><td>Amount Paid</td><td>({doc.amount_paid_display})</td></tr>
            <tr><td>Balance</td><td>{doc.balance_display}</td></tr>
          </tbody>
        </table>
      </div>

      <section className="inv-bank">
        <h2>Bank Details</h2>
        {(doc.company.banks?.length ? doc.company.banks : [{
          currency_code: "",
          account_name: doc.company.bank_account_name,
          account_number: doc.company.bank_account_number,
          iban: doc.company.bank_iban,
          swift: doc.company.bank_swift,
          bank_name: doc.company.bank_name,
          branch: doc.company.bank_branch,
          branch_code: doc.company.bank_branch_code,
          correspondent: doc.company.bank_correspondent,
          correspondent_swift: doc.company.bank_correspondent_swift,
        }]).map((bank, index) => (
          <dl className="inv-bank-grid" key={`${bank.account_number}-${index}`}>
            {bank.currency_code ? <div><dt>Currency</dt><dd>{bank.currency_code}</dd></div> : null}
            <div><dt>Account Name</dt><dd>{bank.account_name}</dd></div>
            <div><dt>Account Number</dt><dd>{bank.account_number}</dd></div>
            <div><dt>IBAN</dt><dd>{bank.iban}</dd></div>
            <div><dt>SWIFT Code</dt><dd>{bank.swift}</dd></div>
            <div><dt>Bank</dt><dd>{bank.bank_name}</dd></div>
            <div><dt>Branch Code</dt><dd>{bank.branch_code}</dd></div>
            <div><dt>Branch</dt><dd>{bank.branch}</dd></div>
            {bank.correspondent ? <div><dt>Corresponding Bank</dt><dd>{bank.correspondent}</dd></div> : null}
            {bank.correspondent_swift ? <div><dt>SWIFT Code</dt><dd>{bank.correspondent_swift}</dd></div> : null}
          </dl>
        ))}
      </section>

      {terms.length ? (
        <section className="inv-terms">
          <h2>Terms and Conditions</h2>
          <ol>
            {terms.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </section>
      ) : null}

      {doc.notes ? <section className="inv-notes"><h2>Notes</h2><p>{doc.notes}</p></section> : null}

      {doc.payments.length ? (
        <section className="inv-payments">
          <h2>Payments</h2>
          <table>
            <thead><tr><th>Date</th><th>Mode</th><th>Amount Received</th><th>Payment Account</th></tr></thead>
            <tbody>
              {doc.payments.map((row, index) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td>{row.mode}</td>
                  <td>{row.amount_display}</td>
                  <td>{row.account || row.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {doc.company.invoice_footer ? <footer className="inv-footer">{doc.company.invoice_footer}</footer> : null}
    </article>
  )
}
