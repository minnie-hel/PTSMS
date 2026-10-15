import { lazy, Suspense } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { useAuth } from "./auth"
import { Guard, Shell } from "./ui"
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from "./pages/Login"

const DashboardPage = lazy(() => import("./pages/Home").then((m) => ({ default: m.DashboardPage })))
const ActivitiesPage = lazy(() => import("./pages/Home").then((m) => ({ default: m.ActivitiesPage })))
const FollowUpsPage = lazy(() => import("./pages/Home").then((m) => ({ default: m.FollowUpsPage })))
const OperationsPage = lazy(() => import("./pages/Home").then((m) => ({ default: m.OperationsPage })))
const PipelinePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.PipelinePage })))
const ModuleReportsPage = lazy(() => import("./pages/Reports").then((m) => ({ default: m.ModuleReportsPage })))
const SystemReportsPage = lazy(() => import("./pages/SystemReports").then((m) => ({ default: m.SystemReportsPage })))
const ClientsPage = lazy(() => import("./pages/Crm").then((m) => ({ default: m.ClientsPage })))
const ClientDetailPage = lazy(() => import("./pages/Crm").then((m) => ({ default: m.ClientDetailPage })))
const LeadsPage = lazy(() => import("./pages/Crm").then((m) => ({ default: m.LeadsPage })))
const LeadDetailPage = lazy(() => import("./pages/Crm").then((m) => ({ default: m.LeadDetailPage })))
const BookingPage = lazy(() => import("./pages/Booking").then((m) => ({ default: m.BookingPage })))
const BookingsPage = lazy(() => import("./pages/Booking").then((m) => ({ default: m.BookingsPage })))
const CashbookPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.CashbookPage })))
const ExpensesPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.ExpensesPage })))
const InvoiceDetailPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.InvoiceDetailPage })))
const InvoicesPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.InvoicesPage })))
const ItinerariesPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.ItinerariesPage })))
const ItineraryDetailPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.ItineraryDetailPage })))
const HotelPaymentsPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.HotelPaymentsPage })))
const PaymentsPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.PaymentsPage })))
const ProfitPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.ProfitPage })))
const QuotationDetailPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.QuotationDetailPage })))
const QuotationsPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.QuotationsPage })))
const VendorsPage = lazy(() => import("./pages/Office").then((m) => ({ default: m.VendorsPage })))
const SettingsPage = lazy(() => import("./pages/Admin").then((m) => ({ default: m.SettingsPage })))
const RolesPage = lazy(() => import("./pages/Users").then((m) => ({ default: m.RolesPage })))
const UsersPage = lazy(() => import("./pages/Users").then((m) => ({ default: m.UsersPage })))

function ScreenFallback() {
  return <p className="page-loading">Loading…</p>
}

export default function App() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Guard code="dashboard.view"><DashboardPage /></Guard>} />
          <Route path="/leads" element={<Guard code="leads.view"><LeadsPage /></Guard>} />
          <Route path="/leads/:id" element={<Guard code="leads.view"><LeadDetailPage /></Guard>} />
          <Route path="/clients" element={<Guard code="clients.view"><ClientsPage /></Guard>} />
          <Route path="/clients/:id" element={<Guard code="clients.view"><ClientDetailPage /></Guard>} />
          <Route path="/follow-ups" element={<Guard code="leads.view"><FollowUpsPage /></Guard>} />
          <Route path="/activities" element={<Guard code="leads.view"><ActivitiesPage /></Guard>} />
          <Route path="/quotations" element={<Guard code="quotations.view"><QuotationsPage /></Guard>} />
          <Route path="/quotations/:id" element={<Guard code="quotations.view"><QuotationDetailPage /></Guard>} />
          <Route path="/itineraries" element={<Guard code="itineraries.view"><ItinerariesPage /></Guard>} />
          <Route path="/itineraries/:id" element={<Guard code="itineraries.view"><ItineraryDetailPage /></Guard>} />
          <Route path="/pipeline" element={<Guard code="quotations.view"><PipelinePage /></Guard>} />
          <Route path="/bookings" element={<Guard code="bookings.view"><Outlet /></Guard>}>
            <Route index element={<BookingsPage />} />
            <Route path="upcoming" element={<BookingsPage listPreset="upcoming" />} />
            <Route path="in-progress" element={<BookingsPage listPreset="in_progress" />} />
            <Route path="completed" element={<BookingsPage listPreset="completed" />} />
            <Route path="new" element={<BookingPage />} />
            <Route path=":id" element={<BookingPage />} />
          </Route>
          <Route path="/operations" element={<Guard code="operations.view"><OperationsPage /></Guard>} />
          <Route path="/vendors" element={<Guard code="vendors.view"><VendorsPage /></Guard>} />
          <Route path="/invoices" element={<Guard code="invoices.view"><InvoicesPage /></Guard>} />
          <Route path="/invoices/:id" element={<Guard code="invoices.view"><InvoiceDetailPage /></Guard>} />
          <Route path="/payments" element={<Guard code="payments.view"><PaymentsPage /></Guard>} />
          <Route path="/hotel-payments" element={<Guard code="costs.view"><HotelPaymentsPage /></Guard>} />
          <Route path="/expenses" element={<Guard code="expenses.view"><ExpensesPage /></Guard>} />
          <Route path="/cashbook" element={<Guard code="cashbook.view"><CashbookPage /></Guard>} />
          <Route path="/profit" element={<Guard code="profitability.view"><ProfitPage /></Guard>} />
          <Route path="/reports/modules" element={<Guard code="reports.view"><ModuleReportsPage /></Guard>} />
          <Route path="/reports/system" element={<Guard code="reports.view"><SystemReportsPage /></Guard>} />
          <Route path="/reports" element={<Navigate to="/reports/modules" replace />} />
          <Route path="/users" element={<Guard code="users.view"><UsersPage /></Guard>} />
          <Route path="/roles" element={<Guard code="roles.view"><RolesPage /></Guard>} />
          <Route path="/team" element={<Navigate to="/users" replace />} />
          <Route path="/settings" element={<Guard code="settings.view"><SettingsPage /></Guard>} />
          <Route path="*" element={<Missing />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function Missing() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <p>That screen is not in the system.</p>
}
