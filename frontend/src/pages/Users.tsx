import { useEffect, useMemo, useState, type FormEvent } from "react"
import { api, apiList } from "../api"
import { useAuth } from "../auth"
import { Badge, Banner, Field, Modal, PageTitle } from "../ui"
import { EmptyRow, FilterSelect, ListToolbar, RecordForm, RowActions, useList } from "../lists"

type Role = {
  id: number
  name: string
  description: string
  permission_codes: string[]
  user_count: number
}
type Person = {
  id: number
  full_name: string
  email: string
  phone: string
  role: number | null
  role_name: string | null
  is_superadmin: boolean
  is_active: boolean
}

export function UsersPage() {
  const { can, user: me } = useAuth()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const { rows, loading, error, load, remove } = useList<Person>("/api/users/", search, { role, is_active: status })
  const [roles, setRoles] = useState<Role[]>([])
  const [editing, setEditing] = useState<Person | "new" | null>(null)
  const [viewing, setViewing] = useState<Person | null>(null)

  useEffect(() => {
    apiList<Role>("/api/roles/").then(setRoles).catch(() => setRoles([]))
  }, [])

  const roleOptions = roles.map((item) => ({ value: item.id, label: item.name }))

  async function save(values: Record<string, string>) {
    const body: Record<string, unknown> = {
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      role: values.role ? Number(values.role) : null,
      is_active: Boolean(values.is_active),
    }
    if (values.password) body.password = values.password
    if (editing === "new") await api("/api/users/", { method: "POST", body: JSON.stringify(body) })
    else if (editing) await api(`/api/users/${editing.id}/`, { method: "PATCH", body: JSON.stringify(body) })
    setEditing(null)
    load()
  }

  return (
    <>
      <PageTitle title="Users" lede="Staff accounts. Each person gets one role that decides what they can see and do." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, email or phone"
        createLabel={can("users.create") ? "New user" : undefined}
        onCreate={() => setEditing("new")}
        filters={
          <>
            <FilterSelect value={role} onChange={setRole} label="All roles" options={roleOptions} />
            <FilterSelect
              value={status}
              onChange={setStatus}
              label="Any status"
              options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]}
            />
          </>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th className="actions-col">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.full_name}</strong>{row.is_superadmin ? <div className="muted">Super Admin</div> : null}</td>
                <td>{row.email}</td>
                <td>{row.phone || "—"}</td>
                <td>{row.role_name || (row.is_superadmin ? "All access" : "No role")}</td>
                <td><Badge value={row.is_active ? "active" : "cancelled"} label={row.is_active ? "Active" : "Inactive"} /></td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("users.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("users.delete") && !row.is_superadmin && row.id !== me?.id ? () => remove(row.id) : undefined}
                    deleteName={row.full_name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6}>No users match. Create a role first, then add the person.</EmptyRow> : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <RecordForm
          title={editing === "new" ? "New user" : "Edit user"}
          initial={editing === "new" ? { is_active: true } : { ...editing }}
          fields={[
            { name: "full_name", label: "Full name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone", label: "Phone" },
            { name: "role", label: "Role", type: "select", options: roleOptions, required: true, empty: "Choose a role" },
            {
              name: "password",
              label: editing === "new" ? "Password" : "New password (leave empty to keep)",
              type: "password",
              required: editing === "new",
            },
            { name: "is_active", label: "Account is active", type: "checkbox" },
          ]}
          note={roles.length === 0 ? "There are no roles yet. Create a role under Users → Roles first." : undefined}
          submitLabel={editing === "new" ? "Create user" : "Save changes"}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {viewing ? (
        <Modal title={viewing.full_name} onClose={() => setViewing(null)}>
          <dl className="detail-list">
            <dt>Email</dt><dd>{viewing.email}</dd>
            <dt>Phone</dt><dd>{viewing.phone || "—"}</dd>
            <dt>Role</dt><dd>{viewing.role_name || (viewing.is_superadmin ? "Super Admin (all access)" : "No role")}</dd>
            <dt>Status</dt><dd>{viewing.is_active ? "Active" : "Inactive"}</dd>
          </dl>
        </Modal>
      ) : null}
    </>
  )
}

/* ---------------------------------------------------------------- roles */

type Catalog = {
  modules: { module: string; resources: { resource: string; label: string; actions: string[] }[] }[]
  actions: Record<string, string>
}

const ACTION_ORDER = ["view", "create", "edit", "delete", "manage"]

/** Mirrors the server: manage grants every action, and any action implies view. */
function normalize(codes: Iterable<string>, catalog: Catalog) {
  const info = new Map(catalog.modules.flatMap((module) => module.resources).map((item) => [item.resource, item.actions]))
  const result = new Set<string>()
  for (const code of codes) {
    const [resource, action] = code.split(".")
    result.add(code)
    if (action === "manage") (info.get(resource) || ACTION_ORDER).forEach((item) => result.add(`${resource}.${item}`))
    if (action !== "view") result.add(`${resource}.view`)
  }
  return result
}

function RoleEditor({
  role,
  readOnly,
  onClose,
  onSaved,
}: {
  role?: Role
  readOnly?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [name, setName] = useState(role?.name || "")
  const [description, setDescription] = useState(role?.description || "")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState(0)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<Catalog>("/api/permission-catalog/")
      .then((data) => {
        setCatalog(data)
        setSelected(normalize(role?.permission_codes || [], data))
      })
      .catch((err: Error) => setError(err.message))
  }, [role])

  const current = catalog?.modules[tab]

  function toggle(resource: string, actions: string[], action: string, checked: boolean) {
    if (!catalog) return
    const next = new Set(selected)
    const code = (item: string) => `${resource}.${item}`
    if (checked) {
      next.add(code(action))
      if (action === "manage") actions.forEach((item) => next.add(code(item)))
      else if (action !== "view") next.add(code("view"))
      const others = actions.filter((item) => item !== "manage")
      if (others.every((item) => next.has(code(item))) && actions.includes("manage")) next.add(code("manage"))
    } else {
      next.delete(code(action))
      if (action === "view") actions.forEach((item) => next.delete(code(item)))
      else next.delete(code("manage"))
    }
    setSelected(next)
  }

  function setModule(checked: boolean) {
    if (!current) return
    const next = new Set(selected)
    for (const item of current.resources) for (const action of item.actions) {
      if (checked) next.add(`${item.resource}.${action}`)
      else next.delete(`${item.resource}.${action}`)
    }
    setSelected(next)
  }

  function countFor(module: Catalog["modules"][number]) {
    return module.resources.reduce((total, item) => total + item.actions.filter((action) => selected.has(`${item.resource}.${action}`)).length, 0)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const body = JSON.stringify({ name, description, permission_codes: [...selected].sort() })
      if (role) await api(`/api/roles/${role.id}/`, { method: "PATCH", body })
      else await api("/api/roles/", { method: "POST", body })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the role")
    } finally {
      setBusy(false)
    }
  }

  const title = readOnly ? role?.name || "Role" : role ? "Edit role" : "New role"
  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={submit} className="stack">
        <Banner>{error}</Banner>
        <div className="form-grid">
          <Field label="Role name">
            <input value={name} onChange={(event) => setName(event.target.value)} required disabled={readOnly} placeholder="For example Reservations" />
          </Field>
          <Field label="Description">
            <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={readOnly} placeholder="What this desk does" />
          </Field>
        </div>

        {catalog && current ? (
          <div>
            <div className="perm-tabs" role="tablist">
              {catalog.modules.map((module, index) => {
                const count = countFor(module)
                return (
                  <button
                    key={module.module}
                    type="button"
                    role="tab"
                    aria-selected={index === tab}
                    className={`perm-tab ${index === tab ? "active" : ""}`}
                    onClick={() => setTab(index)}
                  >
                    {module.module}{count ? <small>{count}</small> : null}
                  </button>
                )
              })}
            </div>
            <div className="table-wrap perm-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      Submodule
                      {!readOnly ? (
                        <>
                          {" "}
                          <button type="button" className="ghost perm-all" onClick={() => setModule(true)}>Select all</button>
                          <button type="button" className="ghost perm-all" onClick={() => setModule(false)}>Clear</button>
                        </>
                      ) : null}
                    </th>
                    {ACTION_ORDER.map((action) => <th key={action}>{catalog.actions[action]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {current.resources.map((item) => (
                    <tr key={item.resource}>
                      <td><strong>{item.label}</strong></td>
                      {ACTION_ORDER.map((action) => (
                        <td key={action}>
                          {item.actions.includes(action) ? (
                            <input
                              type="checkbox"
                              aria-label={`${catalog.actions[action]} ${item.label}`}
                              disabled={readOnly}
                              checked={selected.has(`${item.resource}.${action}`)}
                              onChange={(event) => toggle(item.resource, item.actions, action, event.target.checked)}
                            />
                          ) : <span className="perm-na">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !error ? <p className="muted">Loading permissions…</p> : null}

        <div className="row">
          {!readOnly ? <button className="primary" type="submit" disabled={busy || !catalog}>{busy ? "Saving…" : role ? "Save role" : "Create role"}</button> : null}
          <button type="button" className="ghost" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
        </div>
      </form>
    </Modal>
  )
}

export function RolesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const { rows, loading, error, load, remove } = useList<Role>("/api/roles/", search)
  const [editing, setEditing] = useState<Role | "new" | null>(null)
  const [viewing, setViewing] = useState<Role | null>(null)

  const summary = useMemo(
    () => (role: Role) => {
      const manage = role.permission_codes.filter((code) => code.endsWith(".manage")).length
      return `${role.permission_codes.length} permissions${manage ? ` · ${manage} full access` : ""}`
    },
    [],
  )

  return (
    <>
      <PageTitle title="Roles" lede="A role is a set of permissions. Pick a module tab, then tick what the role may do on each submodule." />
      <Banner>{error}</Banner>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search roles"
        createLabel={can("roles.create") ? "New role" : undefined}
        onCreate={() => setEditing("new")}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Role</th><th>Description</th><th>Access</th><th>Users</th><th className="actions-col">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.name}</strong></td>
                <td>{row.description || "—"}</td>
                <td>{summary(row)}</td>
                <td>{row.user_count}</td>
                <td>
                  <RowActions
                    onView={() => setViewing(row)}
                    onEdit={can("roles.edit") ? () => setEditing(row) : undefined}
                    onDelete={can("roles.delete") ? () => remove(row.id) : undefined}
                    deleteName={row.name}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={5}>No roles yet. Create one to start adding staff.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RoleEditor
          role={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      ) : null}
      {viewing ? <RoleEditor role={viewing} readOnly onClose={() => setViewing(null)} onSaved={() => undefined} /> : null}
    </>
  )
}
