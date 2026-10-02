import { useState } from "react"
import { api } from "../api"
import { useAuth } from "../auth"
import { CompanySettingsPanel } from "../companySettings"
import { Banner, PageTitle } from "../ui"
import { DetailModal, EmptyRow, ListToolbar, RecordForm, RowActions, useClientPagination, useList } from "../lists"
import { crudSuccessMessage } from "../toast"

type Row = Record<string, unknown> & { id: number }
type SettingsTab = "company" | "payments" | "currencies" | "destinations" | "safari-types" | "lead-sources" | "client-types" | "expense-categories"

const TABS: { id: SettingsTab; label: string; path?: string; coded?: boolean; itemName?: string }[] = [
  { id: "company", label: "Company settings" },
  { id: "payments", label: "Payment methods", path: "payment-methods", itemName: "payment method" },
  { id: "currencies", label: "Currencies", path: "currencies", coded: true, itemName: "currency" },
  { id: "destinations", label: "Destinations", path: "destinations", itemName: "destination" },
  { id: "safari-types", label: "Safari types", path: "safari-types", itemName: "safari type" },
  { id: "lead-sources", label: "Lead sources", path: "lead-sources", itemName: "lead source" },
  { id: "client-types", label: "Client types", path: "client-types", itemName: "client type" },
  { id: "expense-categories", label: "Expense categories", path: "expense-categories", itemName: "expense category" },
]

export function SettingsPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<SettingsTab>("company")
  const active = TABS.find((item) => item.id === tab)!
  const listPath = tab === "company" ? "" : `/api/${active.path}/`
  const { rows: allRows, loading, error: listError, load, remove } = useList<Row>(listPath, "")
  const pag = useClientPagination(allRows)
  const rows = pag.rows
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const canEdit = can("settings.edit")

  return (
    <>
      <PageTitle title="Settings" lede="Company profile, bank details for invoices, and master lists used across CRM, bookings, and finance." />
      <Banner>{listError}</Banner>
      <div className="perm-tabs no-print">
        {TABS.map((item) => (
          <button type="button" key={item.id} className={`perm-tab ${item.id === tab ? "active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "company" ? (
        <div style={{ marginTop: 14 }}>
          <CompanySettingsPanel canEdit={canEdit} />
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ListToolbar
            page={pag.page}
            pageSize={pag.pageSize}
            total={pag.total}
            onPageChange={pag.setPage}
            createLabel={can("settings.create") ? `Add new` : undefined}
            onCreate={() => setEditing("new")}
          />
          <div className="table-wrap">
            <table>
              <thead><tr>{active.coded ? <th>Code</th> : null}<th>Name</th><th className="actions-col">Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {active.coded ? <td><strong>{String(row.code)}</strong></td> : null}
                    <td>{String(row.name)}</td>
                    <td>
                      <RowActions
                        onView={() => setViewing(row)}
                        onEdit={can("settings.edit") ? () => setEditing(row) : undefined}
                        onDelete={can("settings.delete") ? async () => { await remove(row.id) } : undefined}
                        deleteName={String(row.name)}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? <EmptyRow colSpan={active.coded ? 3 : 2}>Nothing here yet.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing ? (
        <DetailModal
          title={String(viewing.name)}
          items={[["List", active.label], ...(active.coded ? [["Code", String(viewing.code)] as [string, string]] : []), ["Name", String(viewing.name)]]}
          onClose={() => setViewing(null)}
          onEdit={can("settings.edit") ? () => { setEditing(viewing); setViewing(null) } : undefined}
        />
      ) : null}
      {editing && active.path ? (
        <RecordForm
          formKey={editing === "new" ? "new" : String(editing.id)}
          title={editing === "new" ? `Add to ${active.label.toLowerCase()}` : `Edit ${String(editing.name)}`}
          initial={editing === "new" ? {} : { code: editing.code as string, name: editing.name as string }}
          fields={[
            ...(active.coded ? [{ name: "code", label: "Code", required: true, placeholder: "For example TSH" }] : []),
            { name: "name", label: "Name", required: true },
          ]}
          onSubmit={async (values) => {
            const body = JSON.stringify(active.coded ? { code: values.code, name: values.name } : { name: values.name })
            if (editing === "new") await api(`/api/${active.path}/`, { method: "POST", body })
            else await api(`/api/${active.path}/${editing.id}/`, { method: "PATCH", body })
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
