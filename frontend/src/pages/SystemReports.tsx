import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api, apiList } from "../api"
import { PageTitle } from "../ui"

type AuditRow = {
  id: number
  when: string
  actor: string
  action: string
  entity_type: string
  entity_id: string
  message: string
}

type ActivityRow = {
  id: number
  type_label: string
  body: string
  created_by_name: string
  created_at: string
}

export function SystemReportsPage() {
  const [tab, setTab] = useState<"activities" | "audit">("activities")
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    apiList<ActivityRow>("/api/activities/?page_size=200")
      .then(setActivities)
      .catch(() => {})
    api<{ results: AuditRow[] }>("/api/audit-logs/?limit=200")
      .then((data) => setAudits(data.results))
      .catch(() => {})
  }, [])

  function exportCsv() {
    const rows =
      tab === "activities"
        ? activities.map((row) => [row.created_at, row.type_label, row.body, row.created_by_name])
        : audits.map((row) => [row.when, row.actor, row.action, row.entity_type, row.entity_id, row.message])
    const header =
      tab === "activities"
        ? ["When", "Type", "Note", "Staff"]
        : ["When", "Staff", "Action", "Entity", "Id", "Message"]
    const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ptsms-system-${tab}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageTitle title="System reports" lede="Staff activities and audit log entries across the desk.">
        <button type="button" className="no-print" onClick={() => window.print()}>Print</button>
        <button type="button" className="primary no-print" onClick={exportCsv}>Export CSV</button>
      </PageTitle>
      {error ? <div className="banner">{error}</div> : null}
      <div className="filters no-print">
        <button type="button" className={tab === "activities" ? "primary" : ""} onClick={() => setTab("activities")}>
          Staff activities
        </button>
        <button type="button" className={tab === "audit" ? "primary" : ""} onClick={() => setTab("audit")}>
          Audit log
        </button>
      </div>
      {tab === "activities" ? (
        <div className="table-wrap sheet">
          <table>
            <thead><tr><th>When</th><th>Type</th><th>Note</th><th>Staff</th></tr></thead>
            <tbody>
              {activities.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.type_label}</td>
                  <td>{row.body}</td>
                  <td>{row.created_by_name}</td>
                </tr>
              ))}
              {activities.length === 0 ? <tr><td colSpan={4}>No activities recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap sheet">
          <table>
            <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Record</th><th>Message</th></tr></thead>
            <tbody>
              {audits.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.when).toLocaleString()}</td>
                  <td>{row.actor || "—"}</td>
                  <td>{row.action}</td>
                  <td>{row.entity_type} {row.entity_id}</td>
                  <td>{row.message}</td>
                </tr>
              ))}
              {audits.length === 0 ? <tr><td colSpan={5}>No audit entries yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted no-print">
        CRM activities are also on the <Link to="/activities">Activities</Link> screen.
      </p>
    </>
  )
}
