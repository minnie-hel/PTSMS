import { useEffect, useState, type ReactNode } from "react"
import { clearSession } from "../api"
import { LogoImage, useCompany } from "../company"
import { PageTitle } from "../ui"
import { ModuleCard, type Tone } from "../cards"
import {
  IconBed,
  IconBook,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconCompass,
  IconDocument,
  IconPulse,
  IconReceipt,
  IconUser,
  IconUsers,
  IconWallet,
  IconBell,
} from "../icons"

const MODULE_LOOK: Record<string, { icon: ReactNode; tone: Tone }> = {
  leads: { icon: <IconUsers />, tone: "navy" },
  clients: { icon: <IconUser />, tone: "teal" },
  activities: { icon: <IconPulse />, tone: "purple" },
  follow_ups: { icon: <IconBell />, tone: "amber" },
  quotations: { icon: <IconDocument />, tone: "orange" },
  itineraries: { icon: <IconCompass />, tone: "teal" },
  bookings: { icon: <IconCalendar />, tone: "green" },
  operations: { icon: <IconCompass />, tone: "navy" },
  vendors: { icon: <IconBuilding />, tone: "purple" },
  stays: { icon: <IconBed />, tone: "rose" },
  invoices: { icon: <IconReceipt />, tone: "orange" },
  client_payments: { icon: <IconWallet />, tone: "green" },
  vendor_payments: { icon: <IconWallet />, tone: "rose" },
  expenses: { icon: <IconReceipt />, tone: "amber" },
  cashbook: { icon: <IconBook />, tone: "navy" },
  profitability: { icon: <IconChart />, tone: "green" },
}

type ModuleMeta = { id: string; title: string; group: string; count: number | null }
type ReportColumn = { key: string; label: string }
type ModuleReport = {
  module: string
  title: string
  group: string
  generated_at: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  row_count: number
  extra?: Record<string, unknown>
}

type ReportIndex = {
  groups: Record<string, ModuleMeta[]>
  overview: Record<string, unknown>
}

async function fetchReport(path: string) {
  const access = localStorage.getItem("ptsms_access")
  const response = await fetch(path, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  })
  if (response.status === 401) {
    clearSession()
    window.location.assign("/login")
    throw new Error("Session ended")
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { detail?: string }).detail || "Could not load report")
  }
  if (path.includes("format=csv")) return response.blob()
  return response.json()
}

export function ModuleReportsPage() {
  const { company } = useCompany()
  const [index, setIndex] = useState<ReportIndex | null>(null)
  const [module, setModule] = useState<string | null>(null)
  const [report, setReport] = useState<ModuleReport | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReport("/api/reports/")
      .then((data) => setIndex(data as ReportIndex))
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!module) {
      setReport(null)
      return
    }
    setLoading(true)
    setError("")
    fetchReport(`/api/reports/?module=${module}`)
      .then((data) => setReport(data as ModuleReport))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [module])

  async function exportCsv() {
    if (!module) return
    try {
      const blob = (await fetchReport(`/api/reports/?module=${module}&format=csv`)) as Blob
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `ptsms-${module}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    }
  }

  const viewing = module !== null
  const cards = index ? Object.values(index.groups).flat().filter((item) => item.id !== "overview") : []

  return (
    <>
      <PageTitle
        title="Module reports"
        lede={viewing ? "Print or export this module. All figures come from the live database." : "Choose a module card to open its data."}
      >
        {viewing ? (
          <>
            <button type="button" className="ghost no-print" onClick={() => setModule(null)}>All modules</button>
            <button type="button" className="no-print" onClick={() => window.print()}>Print</button>
            <button type="button" className="primary no-print" onClick={exportCsv} disabled={loading || !report}>
              Export CSV
            </button>
          </>
        ) : null}
      </PageTitle>
      {error ? <div className="banner">{error}</div> : null}

      {!viewing ? (
        <div className="module-grid no-print">
          {cards.map((item) => {
            const look = MODULE_LOOK[item.id] || { icon: <IconDocument />, tone: "navy" as Tone }
            return (
              <ModuleCard
                key={item.id}
                icon={look.icon}
                tone={look.tone}
                label={item.title}
                value={item.count ?? "—"}
                onClick={() => setModule(item.id)}
              />
            )
          })}
          {!index ? <p className="muted">Loading modules…</p> : null}
        </div>
      ) : (
        <article className="report-sheet sheet">
          <header className="report-head">
            <div>
              <LogoImage className="brand-logo" style={{ maxWidth: 140 }} />
              <p>{company.name}</p>
              <h2>{report?.title || "Report"}</h2>
              <p className="muted">
                {report?.generated_at ? new Date(report.generated_at).toLocaleString() : ""}
                {report ? ` · ${report.row_count} rows` : ""}
              </p>
            </div>
          </header>
          {loading ? <p>Loading…</p> : null}
          {report ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {report.columns.map((col) => <th key={col.key}>{col.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {report.columns.map((col) => (
                        <td key={col.key}>{String(row[col.key] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                  {report.rows.length === 0 ? (
                    <tr><td colSpan={report.columns.length}>No rows in this module yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      )}
    </>
  )
}
