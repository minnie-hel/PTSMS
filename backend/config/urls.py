from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    LoginView,
    MeView,
    PasswordView,
    PermissionCatalogView,
    PermissionViewSet,
    RoleViewSet,
    StaffView,
    UserViewSet,
)
from bookings.views import AccommodationViewSet, BookingViewSet, ItineraryViewSet, QuotationViewSet
from catalog.views import (
    BrandingView,
    ClientTypeViewSet,
    CompanyView,
    CurrencyViewSet,
    DestinationViewSet,
    ExpenseCategoryViewSet,
    LeadSourceViewSet,
    PaymentMethodViewSet,
    SafariTypeViewSet,
    VendorTypeViewSet,
)
from common.views import AuditLogView
from crm.views import ActivityViewSet, ClientViewSet, FollowUpView, LeadViewSet
from finance.views import (
    CashbookView,
    ClientPaymentViewSet,
    DashboardView,
    ExpenseViewSet,
    InvoiceViewSet,
    NotificationView,
    ProfitabilityView,
    ReportView,
    VendorPaymentViewSet,
)
from vendors.views import VendorViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("permissions", PermissionViewSet, basename="permission")
router.register("currencies", CurrencyViewSet, basename="currency")
router.register("payment-methods", PaymentMethodViewSet, basename="payment-method")
router.register("destinations", DestinationViewSet, basename="destination")
router.register("safari-types", SafariTypeViewSet, basename="safari-type")
router.register("lead-sources", LeadSourceViewSet, basename="lead-source")
router.register("client-types", ClientTypeViewSet, basename="client-type")
router.register("expense-categories", ExpenseCategoryViewSet, basename="expense-category")
router.register("vendor-types", VendorTypeViewSet, basename="vendor-type")
router.register("leads", LeadViewSet, basename="lead")
router.register("clients", ClientViewSet, basename="client")
router.register("activities", ActivityViewSet, basename="activity")
router.register("vendors", VendorViewSet, basename="vendor")
router.register("bookings", BookingViewSet, basename="booking")
router.register("accommodations", AccommodationViewSet, basename="accommodation")
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("itineraries", ItineraryViewSet, basename="itinerary")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", ClientPaymentViewSet, basename="payment")
router.register("vendor-payments", VendorPaymentViewSet, basename="vendor-payment")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", LoginView.as_view(), name="token"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/auth/password/", PasswordView.as_view(), name="password"),
    path("api/staff/", StaffView.as_view(), name="staff"),
    path("api/permission-catalog/", PermissionCatalogView.as_view(), name="permission-catalog"),
    path("api/branding/", BrandingView.as_view(), name="branding"),
    path("api/company/", CompanyView.as_view(), name="company"),
    path("api/follow-ups/", FollowUpView.as_view(), name="follow-ups"),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/notifications/", NotificationView.as_view(), name="notifications"),
    path("api/audit-logs/", AuditLogView.as_view(), name="audit-logs"),
    path("api/cashbook/", CashbookView.as_view(), name="cashbook"),
    path("api/profitability/", ProfitabilityView.as_view(), name="profitability"),
    path("api/reports/", ReportView.as_view(), name="reports"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
