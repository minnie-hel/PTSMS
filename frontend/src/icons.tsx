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
export function IconEdit() { return <Edit2 size={SMALL} color="currentColor" /> }
export function IconTrash() { return <Trash size={SMALL} color="currentColor" /> }
export function IconArrowRight() { return <ArrowRight3 size={SMALL} color="currentColor" /> }
