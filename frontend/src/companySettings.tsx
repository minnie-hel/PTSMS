import { useEffect, useMemo, useState, type FormEvent } from "react"
import { api, apiList, type CompanyBankAccount, type CompanyProfile } from "./api"
import { useCompany } from "./company"
import {
  COMPANY_CITIES,
  COMPANY_COUNTRIES,
  autofillFromCity,
  autofillFromCountry,
} from "./companyPlaces"
import { Banner, Field } from "./ui"
import { IconPlus, IconTrash } from "./icons"
import { useToast } from "./toast"

function emptyBank(): CompanyBankAccount {
  return {
    currency: null,
    account_name: "",
    account_number: "",
    iban: "",
    swift: "",
    bank_name: "",
    branch: "",
    branch_code: "",
    correspondent: "",
    correspondent_swift: "",
  }
}

function banksFromProfile(profile: CompanyProfile): CompanyBankAccount[] {
  if (profile.banks?.length) return profile.banks.map((bank) => ({ ...bank }))
  if (profile.bank_account_number || profile.bank_name || profile.bank_account_name) {
    return [{
      currency: null,
      account_name: profile.bank_account_name || "",
      account_number: profile.bank_account_number || "",
      iban: profile.bank_iban || "",
      swift: profile.bank_swift || "",
      bank_name: profile.bank_name || "",
      branch: profile.bank_branch || "",
      branch_code: profile.bank_branch_code || "",
      correspondent: profile.bank_correspondent || "",
      correspondent_swift: profile.bank_correspondent_swift || "",
    }]
  }
  return [emptyBank()]
}

function dash(value: string | undefined | null) {
  const text = (value ?? "").trim()
  return text || "—"
}

function InfoItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`company-info-item${wide ? " wide" : ""}`}>
      <span className="company-info-label">{label}</span>
      <strong className="company-info-value">{value}</strong>
    </div>
  )
}

export function CompanySettingsPanel({ canEdit }: { canEdit: boolean }) {
  const { refresh: refreshBranding } = useCompany()
  const toast = useToast()
  const [loaded, setLoaded] = useState<CompanyProfile | null>(null)
  const [draft, setDraft] = useState<CompanyProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [currencies, setCurrencies] = useState<{ id: number; code: string }[]>([])

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ""), [logoFile])
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview) }, [logoPreview])

  useEffect(() => {
    api<CompanyProfile>("/api/company/")
      .then((data) => {
        setLoaded(data)
        if (!editing) setDraft(data)
      })
      .catch(() => {})
    apiList<{ id: number; code: string }>("/api/currencies/").then(setCurrencies).catch(() => setCurrencies([]))
  }, [])

  const view = loaded
  const form = draft ?? loaded

  function startEdit() {
    if (!loaded) return
    setDraft({ ...loaded, banks: banksFromProfile(loaded) })
    setLogoFile(null)
    setEditing(true)
    setError("")
  }

  function cancelEdit() {
    setDraft(loaded ? { ...loaded } : null)
    setLogoFile(null)
    setEditing(false)
    setError("")
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setError("")
    const body = new FormData()
    const textFields: (keyof CompanyProfile)[] = [
      "name",
      "email",
      "phone",
      "city",
      "country",
      "tin_number",
      "vrn_number",
      "address",
      "tagline",
      "welcome_title",
      "welcome_text",
      "primary_color",
      "secondary_color",
      "invoice_terms",
      "invoice_footer",
    ]
    for (const key of textFields) {
      const value = form[key]
      if (typeof value === "string") body.append(key, value)
    }
    body.append("banks", JSON.stringify((form.banks || []).map((bank) => ({
      id: bank.id,
      currency: bank.currency || null,
      account_name: bank.account_name,
      account_number: bank.account_number,
      iban: bank.iban,
      swift: bank.swift,
      bank_name: bank.bank_name,
      branch: bank.branch,
      branch_code: bank.branch_code,
      correspondent: bank.correspondent,
      correspondent_swift: bank.correspondent_swift,
    }))))
    if (logoFile) body.append("logo", logoFile)
    try {
      await api("/api/company/", { method: "PUT", body })
      const fresh = await api<CompanyProfile>("/api/company/")
      setLoaded(fresh)
      setDraft(fresh)
      setLogoFile(null)
      setEditing(false)
      await refreshBranding()
      toast.success("Company information updated.")
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  const countryCode = (editing ? form?.country : view?.country) || "TZ"
  const cityOptions = COMPANY_CITIES[countryCode] || []

  const logoSrc = logoPreview || form?.logo_url || view?.logo_url || ""

  if (!view && !error) return <p className="muted">Loading company information…</p>

  return (
    <>
      <Banner>{error}</Banner>

      <section className="card company-info-card">
        <header className="company-info-header">
          <h2>Company information</h2>
          {canEdit && !editing ? (
            <button type="button" className="primary company-info-edit" onClick={startEdit}>Edit</button>
          ) : null}
        </header>

        {!editing && view ? (
          <div className="company-info-body">
            <div className="company-info-grid">
              <InfoItem label="Company name" value={dash(view.name)} />
              <InfoItem label="TIN" value={dash(view.tin_number)} />
              <InfoItem label="VRN" value={dash(view.vrn_number)} />
              <InfoItem label="Phone number" value={dash(view.phone)} />
              <InfoItem label="Email" value={dash(view.email)} />
              <InfoItem label="Country" value={dash(view.country)} />
              <InfoItem label="City" value={dash(view.city)} />
              <InfoItem label="Address" value={dash(view.address)} />
            </div>
            <div className="company-info-logo-block">
              <span className="company-info-label">Logo</span>
              {view.logo_url ? (
                <div className="company-info-logo-frame">
                  <div className="company-logo-fit">
                    <img src={view.logo_url} alt={view.name || "Company logo"} />
                  </div>
                </div>
              ) : (
                <div className="company-info-logo-frame company-info-logo-frame--empty" aria-hidden>
                  <span className="muted">No logo</span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {editing && form ? (
          <form className="company-info-form company-settings-edit" onSubmit={save}>
            <div className="company-info-body">
              <div className="company-info-form-grid">
                <Field label="Company name">
                  <input value={form.name} onChange={(e) => setDraft({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="TIN">
                  <input value={form.tin_number} onChange={(e) => setDraft({ ...form, tin_number: e.target.value })} />
                </Field>
                <Field label="VRN">
                  <input value={form.vrn_number} onChange={(e) => setDraft({ ...form, vrn_number: e.target.value })} />
                </Field>
                <Field label="Phone number">
                  <input value={form.phone} onChange={(e) => setDraft({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setDraft({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Country">
                  <select
                    className="select-full"
                    value={form.country || ""}
                    onChange={(e) => {
                      const code = e.target.value
                      const patch = autofillFromCountry(code, { phone: form.phone, city: form.city })
                      setDraft({ ...form, country: code, ...patch })
                    }}
                  >
                    <option value="">Choose country</option>
                    {COMPANY_COUNTRIES.map((item) => (
                      <option key={item.code} value={item.code}>{item.label} ({item.code})</option>
                    ))}
                  </select>
                </Field>
                <Field label="City">
                  {cityOptions.length ? (
                    <select
                      className="select-full"
                      value={form.city}
                      onChange={(e) => {
                        const city = e.target.value
                        const patch = autofillFromCity(form.country, city, { address: form.address })
                        setDraft({ ...form, city, ...patch })
                      }}
                    >
                      <option value="">Choose city</option>
                      {form.city && !cityOptions.some((item) => item.name === form.city) ? (
                        <option value={form.city}>{form.city}</option>
                      ) : null}
                      {cityOptions.map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={form.city} onChange={(e) => setDraft({ ...form, city: e.target.value })} placeholder="City" />
                  )}
                </Field>
                <Field label="Address" wide>
                  <input value={form.address} onChange={(e) => setDraft({ ...form, address: e.target.value })} />
                </Field>
              </div>
              <div className="company-info-logo-block">
                <span className="company-info-label">Logo</span>
                {logoSrc ? (
                  <div className="company-info-logo-frame">
                    <div className="company-logo-fit">
                      <img src={logoSrc} alt="Company logo" />
                    </div>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <h3 className="company-settings-subhead">Brand &amp; login</h3>
            <div className="company-info-form-grid">
              <Field label="Tagline"><input value={form.tagline} onChange={(e) => setDraft({ ...form, tagline: e.target.value })} /></Field>
              <Field label="Login welcome title" wide>
                <input value={form.welcome_title} onChange={(e) => setDraft({ ...form, welcome_title: e.target.value })} />
              </Field>
              <Field label="Brand primary colour">
                <input type="color" value={form.primary_color || "#2E3192"} onChange={(e) => setDraft({ ...form, primary_color: e.target.value })} />
              </Field>
              <Field label="Brand secondary colour">
                <input type="color" value={form.secondary_color || "#F7941D"} onChange={(e) => setDraft({ ...form, secondary_color: e.target.value })} />
              </Field>
            </div>

            <h3 className="company-settings-subhead">Bank accounts</h3>
            <p className="muted">Add one account per currency the company can receive. Invoices show the matching account first.</p>
            {(form.banks || []).map((bank, index) => (
              <div key={bank.id ?? `new-${index}`} className="company-bank-card">
                <div className="company-bank-card-head">
                  <strong>Account {index + 1}{bank.currency_code ? ` · ${bank.currency_code}` : ""}</strong>
                  {(form.banks || []).length > 1 ? (
                    <button
                      type="button"
                      className="ghost icon-btn"
                      title="Remove bank"
                      onClick={() => setDraft({ ...form, banks: (form.banks || []).filter((_, i) => i !== index) })}
                    >
                      <IconTrash />
                    </button>
                  ) : null}
                </div>
                <div className="company-info-form-grid">
                  <Field label="Currency">
                    <select
                      className="select-full"
                      value={bank.currency ? String(bank.currency) : ""}
                      onChange={(e) => {
                        const value = e.target.value
                        const next = [...(form.banks || [])]
                        const chosen = currencies.find((item) => String(item.id) === value)
                        next[index] = { ...bank, currency: value ? Number(value) : null, currency_code: chosen?.code }
                        setDraft({ ...form, banks: next })
                      }}
                    >
                      <option value="">Choose currency</option>
                      {currencies.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Bank name"><input value={bank.bank_name} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, bank_name: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Account name"><input value={bank.account_name} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, account_name: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Account number"><input value={bank.account_number} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, account_number: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="SWIFT / BIC"><input value={bank.swift} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, swift: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="IBAN"><input value={bank.iban} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, iban: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Branch"><input value={bank.branch} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, branch: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Branch code"><input value={bank.branch_code} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, branch_code: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Correspondent bank"><input value={bank.correspondent} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, correspondent: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                  <Field label="Correspondent SWIFT"><input value={bank.correspondent_swift} onChange={(e) => {
                    const next = [...(form.banks || [])]
                    next[index] = { ...bank, correspondent_swift: e.target.value }
                    setDraft({ ...form, banks: next })
                  }} /></Field>
                </div>
              </div>
            ))}
            <div className="company-add-bank">
              <button
                type="button"
                className="primary icon-btn-text"
                onClick={() => setDraft({ ...form, banks: [...(form.banks || []), emptyBank()] })}
              >
                <IconPlus /> Add another bank
              </button>
            </div>

            <h3 className="company-settings-subhead">Invoice text</h3>
            <div className="company-info-form-grid">
              <Field label="Invoice terms (one line per point)" wide>
                <textarea value={form.invoice_terms} onChange={(e) => setDraft({ ...form, invoice_terms: e.target.value })} rows={4} />
              </Field>
              <Field label="Invoice footer" wide>
                <textarea value={form.invoice_footer} onChange={(e) => setDraft({ ...form, invoice_footer: e.target.value })} rows={2} />
              </Field>
            </div>

            <div className="form-footer" style={{ marginTop: 16 }}>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              <button type="button" className="ghost" onClick={cancelEdit} disabled={busy}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>

      {!editing && view ? (
        <>
          <section className="card company-info-card">
            <h2 className="company-settings-section-title">Brand &amp; login</h2>
            <div className="company-info-grid">
              <InfoItem label="Tagline" value={dash(view.tagline)} />
              <InfoItem label="Login welcome title" value={dash(view.welcome_title)} />
              <InfoItem label="Welcome text" value={dash(view.welcome_text)} wide />
              <div className="company-info-item">
                <span className="company-info-label">Brand primary colour</span>
                <strong className="company-info-value company-color-swatch">
                  <span style={{ background: view.primary_color || "#2E3192" }} aria-hidden />
                  {dash(view.primary_color)}
                </strong>
              </div>
              <div className="company-info-item">
                <span className="company-info-label">Brand secondary colour</span>
                <strong className="company-info-value company-color-swatch">
                  <span style={{ background: view.secondary_color || "#F7941D" }} aria-hidden />
                  {dash(view.secondary_color)}
                </strong>
              </div>
            </div>
          </section>

          <section className="card company-info-card">
            <h2 className="company-settings-section-title">Bank accounts</h2>
            {(view.banks?.length ? view.banks : banksFromProfile(view)).map((bank, index) => (
              <div key={bank.id ?? index} className="company-info-grid" style={{ marginBottom: 16 }}>
                <InfoItem label="Currency" value={dash(bank.currency_code)} />
                <InfoItem label="Bank name" value={dash(bank.bank_name)} />
                <InfoItem label="Account name" value={dash(bank.account_name)} />
                <InfoItem label="Account number" value={dash(bank.account_number)} />
                <InfoItem label="SWIFT / BIC" value={dash(bank.swift)} />
                <InfoItem label="IBAN" value={dash(bank.iban)} />
                <InfoItem label="Branch" value={dash(bank.branch)} />
                <InfoItem label="Branch code" value={dash(bank.branch_code)} />
                <InfoItem label="Correspondent bank" value={dash(bank.correspondent)} />
                <InfoItem label="Correspondent SWIFT" value={dash(bank.correspondent_swift)} />
              </div>
            ))}
            <h3 className="company-settings-subhead">Invoice text</h3>
            <div className="company-info-grid">
              <InfoItem label="Invoice terms" value={dash(view.invoice_terms)} wide />
              <InfoItem label="Invoice footer" value={dash(view.invoice_footer)} wide />
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}
