import {
  Activity,
  Add,
  ArrowDown2,
  ArrowRight3,
  Book1,
  Buildings2,
  Calendar,
  Category,
  Chart2,
  DocumentText,
  Edit2,
  Eye,
  Filter,
  House2,
  Map1,
  Moon,
  Notification,
  People,
  Receipt2,
  SearchNormal1,
  Setting2,
  ShieldTick,
  SidebarLeft,
  Sun1,
  Trash,
  User,
  Wallet2,
} from "iconsax-react"

/*
 * Every icon in the system comes from Iconsax (linear style). The wrappers keep one
 * name and one size per use, so screens never import the library directly.
 */

const NAV = 18
const SMALL = 16

export function IconBell() { return <Notification size={20} color="currentColor" /> }
export function IconUser() { return <User size={20} color="currentColor" /> }
export function IconSun() { return <Sun1 size={20} color="currentColor" /> }
export function IconMoon() { return <Moon size={20} color="currentColor" /> }

export function IconChevron({ open }: { open: boolean }) {
  return (
    <span className={`nav-chevron ${open ? "open" : ""}`} aria-hidden="true">
      <ArrowDown2 size={14} color="currentColor" />
    </span>
  )
}

/** The panel toggle in the top bar: the same glyph, whichever way the sidebar is going. */
export function IconCollapse({ collapsed }: { collapsed: boolean }) {
  return <SidebarLeft size={20} color="currentColor" variant={collapsed ? "Bold" : "Linear"} />
}

export function IconDashboard() { return <Category size={NAV} color="currentColor" /> }
export function IconUsers() { return <People size={NAV} color="currentColor" /> }
export function IconDocument() { return <DocumentText size={NAV} color="currentColor" /> }
export function IconCalendar() { return <Calendar size={NAV} color="currentColor" /> }
export function IconCompass() { return <Map1 size={NAV} color="currentColor" /> }
export function IconWallet() { return <Wallet2 size={NAV} color="currentColor" /> }
export function IconSettings() { return <Setting2 size={NAV} color="currentColor" /> }
export function IconBuilding() { return <Buildings2 size={NAV} color="currentColor" /> }
export function IconChart() { return <Chart2 size={NAV} color="currentColor" /> }
export function IconBook() { return <Book1 size={NAV} color="currentColor" /> }
export function IconPulse() { return <Activity size={NAV} color="currentColor" /> }
export function IconReceipt() { return <Receipt2 size={NAV} color="currentColor" /> }
export function IconBed() { return <House2 size={NAV} color="currentColor" /> }
export function IconShield() { return <ShieldTick size={NAV} color="currentColor" /> }

export function IconSearch() { return <SearchNormal1 size={SMALL} color="currentColor" /> }
export function IconFilter() { return <Filter size={SMALL} color="currentColor" /> }
export function IconPlus() { return <Add size={SMALL} color="currentColor" /> }
export function IconEye() { return <Eye size={SMALL} color="currentColor" /> }
export function IconEyeOff() {
  return (
    <svg width={SMALL} height={SMALL} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.6 10.6a2.4 2.4 0 0 0 3.4 3.4M9.9 5.2A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.7 11.7 0 0 1-4.1 4.8M6.7 6.7A11.8 11.8 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.6 0 3.1-.3 4.5-.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function IconEdit() { return <Edit2 size={SMALL} color="currentColor" /> }
export function IconTrash() { return <Trash size={SMALL} color="currentColor" /> }
export function IconArrowRight() { return <ArrowRight3 size={SMALL} color="currentColor" /> }
