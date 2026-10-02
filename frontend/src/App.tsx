import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { useAuth } from "./auth"
import { Guard, Shell } from "./ui"
import { LoginPage } from "./pages/Login"
import { ActivitiesPage, DashboardPage, FollowUpsPage, OperationsPage, PipelinePage } from "./pages/Home"
import { ModuleReportsPage } from "./pages/Reports"
import { SystemReportsPage } from "./pages/SystemReports"
import { ClientDetailPage, ClientsPage, LeadDetailPage, LeadsPage } from "./pages/Crm"
import { BookingPage, BookingsPage } from "./pages/Booking"
import {
  CashbookPage,
  ExpensesPage,
  InvoiceDetailPage,
  InvoicesPage,
  ItinerariesPage,
  ItineraryDetailPage,
  HotelPaymentsPage,
  PaymentsPage,
  ProfitPage,
  QuotationDetailPage,
  QuotationsPage,
  VendorsPage,
} from "./pages/Office"
import { SettingsPage } from "./pages/Admin"
import { RolesPage, UsersPage } from "./pages/Users"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
  )
}

function Missing() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <p>That screen is not in the system.</p>
}
