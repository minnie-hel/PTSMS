import { useEffect, useMemo, useState, type FormEvent } from "react"
import { api, type CompanyProfile } from "./api"
import { useCompany } from "./company"
import {
  COMPANY_CITIES,
  COMPANY_COUNTRIES,
  autofillFromCity,
  autofillFromCountry,
} from "./companyPlaces"
import { Banner, Field } from "./ui"
import { useToast } from "./toast"

function dash(value: string | undefined | null) {
  const text = (value ?? "").trim()
  return text || "—"
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="company-info-item">
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

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ""), [logoFile])
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview) }, [logoPreview])

  useEffect(() => {
    api<CompanyProfile>("/api/company/")
      .then((data) => {
        setLoaded(data)
        if (!editing) setDraft(data)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  const view = loaded
  const form = draft ?? loaded

  function startEdit() {
    if (!loaded) return
    setDraft({ ...loaded })
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
      "bank_account_name",
      "bank_account_number",
      "bank_iban",
      "bank_swift",
      "bank_name",
      "bank_branch",
      "bank_branch_code",
      "bank_correspondent",
      "bank_correspondent_swift",
      "invoice_terms",
      "invoice_footer",
    ]
    for (const key of textFields) {
      const value = form[key]
      if (typeof value === "string") body.append(key, value)
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company settings")
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
                  <img src={view.logo_url} alt={view.name || "Company logo"} />
                </div>
              ) : (
                <strong className="company-info-value">—</strong>
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
                    <img src={logoSrc} alt="Company logo" />
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

            <h3 className="company-settings-subhead">Bank &amp; invoices</h3>
            <div className="company-info-form-grid">
              <Field label="Bank account name"><input value={form.bank_account_name} onChange={(e) => setDraft({ ...form, bank_account_name: e.target.value })} /></Field>
              <Field label="Bank account number"><input value={form.bank_account_number} onChange={(e) => setDraft({ ...form, bank_account_number: e.target.value })} /></Field>
              <Field label="Bank name"><input value={form.bank_name} onChange={(e) => setDraft({ ...form, bank_name: e.target.value })} /></Field>
              <Field label="SWIFT / BIC"><input value={form.bank_swift} onChange={(e) => setDraft({ ...form, bank_swift: e.target.value })} /></Field>
              <Field label="IBAN"><input value={form.bank_iban} onChange={(e) => setDraft({ ...form, bank_iban: e.target.value })} /></Field>
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
        <details className="card" style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Brand, bank &amp; invoice text</summary>
          <div className="company-info-grid" style={{ marginTop: 12 }}>
            <InfoItem label="Tagline" value={dash(view.tagline)} />
            <InfoItem label="Welcome title" value={dash(view.welcome_title)} />
            <InfoItem label="Bank account" value={dash(view.bank_account_number)} />
            <InfoItem label="Bank name" value={dash(view.bank_name)} />
          </div>
        </details>
      ) : null}
    </>
  )
}
