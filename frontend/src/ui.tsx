import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { api } from "./api"
import { useAuth } from "./auth"
import { SideLogo } from "./company"
import { useTheme } from "./theme"
import {
  IconBell,
  IconCalendar,
  IconChevron,
  IconCollapse,
  IconCompass,
  IconDashboard,
  IconDocument,
  IconMoon,
  IconShield,
  IconSettings,
  IconSun,
  IconUser,
  IconUsers,
  IconWallet,
} from "./icons"

export function formatMoneyAmount(amount: string | number | null | undefined) {
  if (amount === null || amount === undefined || amount === "") return "—"
  const value = typeof amount === "number" ? amount : Number(String(amount).replace(/,/g, ""))
  if (!Number.isFinite(value)) return String(amount)
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function money(amount: string | number | null | undefined, code?: string) {
  const formatted = formatMoneyAmount(amount)
  if (formatted === "—") return formatted
  return code ? `${code} ${formatted}` : formatted
}

export function moneyList(rows?: { currency: string; amount: string | number }[] | null) {
  if (!rows?.length) return "—"
  return rows.map((row) => money(row.amount, row.currency)).join(" · ")
}

/** Stacked currency lines for dashboard cards (readable amounts, no long single-line strings). */
export function MoneyCardAmounts({ rows }: { rows?: { currency: string; amount: string | number }[] | null }) {
  const items = (rows ?? []).filter((row) => {
    const value = Number(row.amount)
    return Number.isFinite(value) && Math.abs(value) >= 0.005
  })
  if (!items.length) return <>—</>
  return (
    <span className="money-card-amounts">
      {items.map((row) => (
        <span className="money-card-line" key={row.currency}>
          <span className="money-card-code">{row.currency}</span>
          <span className="money-card-num">{formatMoneyAmount(row.amount)}</span>
        </span>
      ))}
    </span>
  )
}

const TONES: Record<string, string> = {
  fully_paid: "good",
  paid: "good",
  accepted: "good",
  confirmed: "good",
  safari_done: "good",
  completed: "good",
  won: "good",
  partial_paid: "warn",
  partially_paid: "warn",
  sent: "info",
  active: "info",
  waiting_for_safari: "info",
  safari_in_progress: "warn",
  overdue: "bad",
  declined: "bad",
  cancelled: "bad",
  lost: "bad",
  not_paid: "bad",
  waiting_for_decisions: "warn",
}

export function Badge({ value, label }: { value?: string; label?: string }) {
  return <span className={`badge ${TONES[value || ""] || ""}`}>{label || value || "—"}</span>
}

export function BackLink({ to, label = "Back to list" }: { to: string; label?: string }) {
  return <Link className="back-link no-print" to={to}>← {label}</Link>
}

export function PageTitle({
  title,
  lede,
  children,
  backTo,
  backLabel,
}: {
  title: string
  lede?: string
  children?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="page-head">
      <div>
        {backTo ? <BackLink to={backTo} label={backLabel} /> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      <div className="actions no-print">{children}</div>
    </div>
  )
}

export function Banner({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="banner">{children}</div>
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      {label}
      {children}
    </label>
  )
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(event) => event.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

type NavLinkItem = { to: string; label: string; code?: string; codes?: string[]; end?: boolean }

type NavGroup = {
  id: string
  label: string
  icon: ReactNode
  children: NavLinkItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <IconDashboard />,
    children: [
      { to: "/", label: "Overview", end: true, code: "dashboard.view" },
      { to: "/reports/modules", label: "Module reports", code: "reports.view" },
      { to: "/reports/system", label: "System reports", code: "reports.view" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: <IconUsers />,
    children: [
      { to: "/leads", label: "Leads", code: "leads.view" },
      { to: "/clients", label: "Clients", code: "clients.view" },
      { to: "/follow-ups", label: "Follow-ups", code: "leads.view" },
      { to: "/activities", label: "Activities", code: "leads.view" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: <IconDocument />,
    children: [
      { to: "/quotations", label: "Quotations", code: "quotations.view" },
      { to: "/itineraries", label: "Itineraries", code: "itineraries.view" },
      { to: "/pipeline", label: "Pipeline", code: "quotations.view" },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: <IconCalendar />,
    children: [
      { to: "/bookings", label: "All bookings", code: "bookings.view", end: true },
      { to: "/bookings/upcoming", label: "Upcoming", code: "bookings.view" },
      { to: "/bookings/in-progress", label: "In progress", code: "bookings.view" },
      { to: "/bookings/completed", label: "Completed", code: "bookings.view" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: <IconCompass />,
    children: [
      { to: "/operations", label: "Safari operations", code: "operations.view" },
      { to: "/vendors", label: "Vendors", code: "vendors.view" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: <IconWallet />,
    children: [
      { to: "/invoices", label: "Invoices", code: "invoices.view" },
      { to: "/payments", label: "Client payments", code: "payments.view" },
      { to: "/hotel-payments", label: "Hotel payments", code: "costs.view" },
      { to: "/expenses", label: "Expenses", code: "expenses.view" },
      { to: "/cashbook", label: "Cashbook", code: "cashbook.view" },
      { to: "/profit", label: "Profitability", code: "profitability.view" },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: <IconShield />,
    children: [
      { to: "/users", label: "Users", code: "users.view" },
      { to: "/roles", label: "Roles", code: "roles.view" },
    ],
  },
  {
    id: "company",
    label: "Company",
    icon: <IconSettings />,
    children: [
      { to: "/settings", label: "Settings", code: "settings.view" },
    ],
  },
]

function useClickAway(ref: React.RefObject<HTMLElement | null>, onAway: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onAway()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onAway, ref])
}

function TopBar({ collapsed, onToggleSide }: { collapsed: boolean; onToggleSide: () => void }) {
  const { user, can, signOut } = useAuth()
  const navigate = useNavigate()
  const { mode, toggle } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notes, setNotes] = useState<{ kind: string; label: string; path: string }[]>([])
  const profileRef = useRef<HTMLDivElement>(null)
  const notifyRef = useRef<HTMLDivElement>(null)
  useClickAway(profileRef, () => setProfileOpen(false), profileOpen)
  useClickAway(notifyRef, () => setNotifyOpen(false), notifyOpen)

  useEffect(() => {
    if (!can("dashboard.view")) return
    api<{ items: { kind: string; label: string; path: string }[] }>("/api/notifications/")
      .then((data) => setNotes(data.items))
      .catch(() => setNotes([]))
  }, [can])

  return (
    <div className="topbar">
      <div className="topbar-lead">
        <button
          type="button"
          className="topbar-icon-btn side-toggle"
          onClick={onToggleSide}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconCollapse collapsed={collapsed} />
        </button>
        <p className="topbar-role">{user?.is_superadmin ? "Super Admin" : user?.role_name || "Staff"}</p>
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={toggle}
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={mode === "dark" ? "Light mode" : "Dark mode"}
        >
          {mode === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <div className="topbar-menu" ref={notifyRef}>
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() => setNotifyOpen((open) => !open)}
            aria-label="Notifications"
          >
            <IconBell />
            {notes.length ? <span className="topbar-dot" /> : null}
          </button>
          {notifyOpen ? (
            <div className="topbar-panel">
              {notes.length ? (
                notes.map((item) => (
                  <Link key={item.label} to={item.path} onClick={() => setNotifyOpen(false)}>
                    {item.label}
                  </Link>
                ))
              ) : (
                <p className="muted topbar-empty">Nothing needs attention.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="topbar-menu" ref={profileRef}>
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Profile menu"
          >
            <IconUser />
          </button>
          {profileOpen ? (
            <div className="topbar-panel topbar-panel-profile">
              <p className="topbar-panel-title">{user?.full_name}</p>
              <p className="muted topbar-panel-email">{user?.email}</p>
              {can("settings.view") ? (
                <Link to="/settings" onClick={() => setProfileOpen(false)}>Settings</Link>
              ) : null}
              <button
                type="button"
                className="topbar-logout"
                onClick={() => {
                  setProfileOpen(false)
                  signOut()
                  navigate("/login")
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const BOOKING_SUBMODULES = new Set(["upcoming", "in-progress", "completed", "new"])

function isChildActive(child: NavLinkItem, pathname: string) {
  if (child.end) {
    if (pathname === child.to) return true
    if (child.to === "/bookings") {
      const segment = pathname.split("/")[2]
      if (segment && !BOOKING_SUBMODULES.has(segment)) return true
    }
    return false
  }
  return pathname === child.to || pathname.startsWith(`${child.to}/`)
}

function visibleChildren(group: NavGroup, can: (code: string) => boolean) {
  return group.children.filter((child) => {
    if (child.codes?.length) return child.codes.some((code) => can(code))
    if (child.code) return can(child.code)
    return true
  })
}

function NavDropdown({
  group,
  can,
  pathname,
  open,
  collapsed,
  onToggle,
}: {
  group: NavGroup
  can: (code: string) => boolean
  pathname: string
  open: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const visible = visibleChildren(group, can)
  if (!visible.length) return null
  const active = visible.some((child) => isChildActive(child, pathname))
  const expanded = open && !collapsed

  return (
    <div className={`nav-dropdown ${expanded ? "open" : ""}`}>
      <button
        type="button"
        className={`nav-dropdown-toggle ${active ? "active" : ""}`}
        onClick={onToggle}
        title={collapsed ? group.label : undefined}
        aria-expanded={expanded}
      >
        <span className="nav-icon">{group.icon}</span>
        <span className="nav-label-text">{group.label}</span>
        <IconChevron open={expanded} />
      </button>
      {expanded ? (
        <div className="nav-dropdown-menu">
          {visible.map((child) => (
            <NavLink key={child.to} to={child.to} end={child.end} className="nav-dropdown-link">
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const LANDED_KEY = "ptsms_landed"
const COLLAPSE_KEY = "ptsms_side_collapsed"

export function Shell() {
  const { user, can, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1")
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const activeGroup = NAV_GROUPS.find((group) =>
    visibleChildren(group, can).some((child) => isChildActive(child, location.pathname)),
  )?.id

  // A new browser session always opens on the overview.
  useEffect(() => {
    if (loading || !user) return
    if (sessionStorage.getItem(LANDED_KEY)) return
    sessionStorage.setItem(LANDED_KEY, "1")
    if (can("dashboard.view") && location.pathname !== "/") navigate("/", { replace: true })
  }, [loading, user, can, location.pathname, navigate])

  // Moving to a screen opens its group and closes every other group.
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup)
  }, [activeGroup, location.pathname])

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  if (loading) return <p className="page">Opening the desk…</p>
  if (!user) return <Navigate to="/login" replace />

  function toggleGroup(id: string) {
    if (collapsed) {
      setCollapsed(false)
      setOpenGroup(id)
      return
    }
    setOpenGroup((current) => (current === id ? null : id))
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="side">
        <div className="side-header">
          <SideLogo collapsed={collapsed} />
        </div>
        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <NavDropdown
              key={group.id}
              group={group}
              can={can}
              pathname={location.pathname}
              open={openGroup === group.id}
              collapsed={collapsed}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </nav>
      </aside>
      <div className="main">
        <TopBar collapsed={collapsed} onToggleSide={() => setCollapsed((value) => !value)} />
        <div className="page page-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function Guard({ code, children }: { code: string; children: ReactNode }) {
  const { can, loading } = useAuth()
  if (loading) return null
  if (!can(code)) return <p>Your role does not include this screen.</p>
  return children
}

export function GuardAny({ codes, children }: { codes: string[]; children: ReactNode }) {
  const { can, loading } = useAuth()
  if (loading) return null
  if (!codes.some((code) => can(code))) return <p>Your role does not include this screen.</p>
  return children
}
