from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Permission, Role
from bookings.models import Booking
from bookings.services import resolved_safari_status
from catalog.models import Currency, Destination, PaymentMethod, SafariType
from finance.services import cashbook

User = get_user_model()


class BookingFlowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@test.local",
            password="test-pass-123",
            full_name="Admin",
            is_superadmin=True,
        )
        self.client.force_authenticate(self.admin)
        self.usd = Currency.objects.create(code="USD", name="US Dollar")
        self.tsh = Currency.objects.create(code="TSH", name="Tanzanian Shilling")
        self.park = Destination.objects.create(name="Serengeti")
        self.kind = SafariType.objects.create(name="Mid-range")
        self.method = PaymentMethod.objects.create(name="Bank Transfer")
        self.lead = self.client.post(
            "/api/leads/",
            {
                "full_name": "Amina Kimaro",
                "email": "amina@example.com",
                "country": "Tanzania",
                "adults": 2,
                "children": 1,
                "destination_ids": [self.park.id],
                "safari_type": self.kind.id,
                "budget": "8000.00",
                "currency": self.usd.id,
            },
            format="json",
        )
        self.assertEqual(self.lead.status_code, 201, self.lead.data)

    def test_booking_from_lead_creates_one_client_and_calculates_days(self):
        start = date.today() + timedelta(days=30)
        end = start + timedelta(days=4)
        vendor = self.client.post(
            "/api/vendors/",
            {
                "name": "Serengeti Lodges",
                "properties": [{"name": "Kopjes Camp", "location": "Serengeti"}],
            },
            format="json",
        )
        self.assertEqual(vendor.status_code, 201, vendor.data)
        hotel_id = vendor.data["properties"][0]["id"]
        created = self.client.post(
            "/api/bookings/",
            {
                "booking_date": str(date.today()),
                "lead": self.lead.data["id"],
                "safari_type": self.kind.id,
                "destination_ids": [self.park.id],
                "start_date": str(start),
                "end_date": str(end),
                "adults": 2,
                "children": 1,
                "total_amount": "8000.00",
                "currency": self.usd.id,
                "accommodations": [
                    {
                        "vendor": vendor.data["id"],
                        "hotel": hotel_id,
                        "check_in": str(start),
                        "check_out": str(start + timedelta(days=2)),
                        "agreed_cost": "2000.00",
                        "cost_currency": self.usd.id,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["safari_days"], 5)
        self.assertEqual(created.data["client_country"], "Tanzania")
        self.assertEqual(created.data["client_payment_status"], "not_paid")
        self.assertEqual(created.data["vendor_payment_status"], "not_paid")
        self.assertEqual(created.data["safari_status"], "waiting_for_decisions")
        self.assertTrue(created.data["reference"].startswith("PTS-"))
        clients = self.client.get("/api/clients/")
        self.assertEqual(clients.data["count"], 1)
        again = self.client.post(
            "/api/bookings/",
            {
                "booking_date": str(date.today()),
                "client": created.data["client"],
                "safari_type": self.kind.id,
                "destination_ids": [self.park.id],
                "start_date": str(start),
                "end_date": str(end),
                "total_amount": "5000.00",
                "currency": self.usd.id,
            },
            format="json",
        )
        self.assertEqual(again.status_code, 201, again.data)
        clients = self.client.get("/api/clients/")
        self.assertEqual(clients.data["count"], 1)

    def test_documents_follow_quotation_then_itinerary_then_invoice(self):
        start = date.today() + timedelta(days=10)
        booking = self.client.post(
            "/api/bookings/",
            {
                "booking_date": str(date.today()),
                "lead": self.lead.data["id"],
                "start_date": str(start),
                "end_date": str(start + timedelta(days=2)),
                "total_amount": "8000.00",
                "currency": self.usd.id,
                "destination_ids": [self.park.id],
            },
            format="json",
        ).data
        blocked = self.client.post(
            "/api/invoices/",
            {"booking": booking["id"], "invoice_date": str(date.today()), "due_date": str(start)},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)
        quotation = self.client.post(
            "/api/quotations/",
            {
                "booking": booking["id"],
                "total_amount": "8000.00",
                "currency": self.usd.id,
                "validity_date": str(date.today() + timedelta(days=14)),
            },
            format="json",
        )
        self.assertEqual(quotation.status_code, 201, quotation.data)
        early = self.client.post("/api/itineraries/", {"booking": booking["id"]}, format="json")
        self.assertEqual(early.status_code, 400)
        accepted = self.client.post(f"/api/quotations/{quotation.data['id']}/accept/")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        itinerary = self.client.post("/api/itineraries/", {"booking": booking["id"], "notes": "Start Arusha"}, format="json")
        self.assertEqual(itinerary.status_code, 201, itinerary.data)
        invoice = self.client.post(
            "/api/invoices/",
            {"booking": booking["id"], "invoice_date": str(date.today()), "due_date": str(start), "payment_terms": "Due before travel"},
            format="json",
        )
        self.assertEqual(invoice.status_code, 201, invoice.data)
        self.assertEqual(invoice.data["total_amount"], "8000.00")
        first_pay = self.client.post(
            "/api/payments/",
            {
                "invoice": invoice.data["id"],
                "paid_on": str(date.today()),
                "amount": "3000.00",
                "payment_method": self.method.id,
            },
            format="json",
        )
        self.assertEqual(first_pay.status_code, 201, first_pay.data)
        refreshed = self.client.get(f"/api/bookings/{booking['id']}/")
        self.assertEqual(refreshed.data["client_payment_status"], "partial_paid")
        self.assertEqual(Decimal(refreshed.data["balance"]), Decimal("5000.00"))
        self.client.post(
            "/api/payments/",
            {
                "invoice": invoice.data["id"],
                "paid_on": str(date.today()),
                "amount": "250000.00",
                "currency": self.tsh.id,
                "amount_applied": "5000.00",
                "payment_method": self.method.id,
            },
            format="json",
        )
        refreshed = self.client.get(f"/api/bookings/{booking['id']}/")
        self.assertEqual(refreshed.data["client_payment_status"], "fully_paid")
        payment_id = first_pay.data["id"]
        patched = self.client.patch(
            f"/api/payments/{payment_id}/",
            {"amount": "2500.00"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        refreshed = self.client.get(f"/api/bookings/{booking['id']}/")
        self.assertEqual(refreshed.data["client_payment_status"], "partial_paid")
        book = cashbook()
        self.assertIn("USD", book["balances"])
        self.assertIn("TSH", book["balances"])
        self.assertEqual(book["balances"]["USD"], Decimal("3000.00"))
        self.assertEqual(book["balances"]["TSH"], Decimal("250000.00"))

    def test_confirmed_safari_status_follows_dates(self):
        booking = Booking(
            overall_status=Booking.Overall.CONFIRMED,
            safari_status=Booking.SafariStatus.WAITING_FOR_DECISIONS,
            start_date=date.today() + timedelta(days=3),
            end_date=date.today() + timedelta(days=6),
        )
        self.assertEqual(resolved_safari_status(booking), Booking.SafariStatus.WAITING_FOR_SAFARI)
        booking.start_date = date.today() - timedelta(days=1)
        booking.end_date = date.today() + timedelta(days=1)
        self.assertEqual(resolved_safari_status(booking), Booking.SafariStatus.SAFARI_IN_PROGRESS)
        booking.end_date = date.today() - timedelta(days=1)
        self.assertEqual(resolved_safari_status(booking), Booking.SafariStatus.SAFARI_DONE)

    def test_staff_without_permission_cannot_open_finance(self):
        view = Permission.objects.get(code="leads.view")
        role = Role.objects.create(name="Front desk")
        role.permissions.add(view)
        staff = User.objects.create_user(
            email="desk@test.local", password="test-pass-123", full_name="Desk", role=role
        )
        self.client.force_authenticate(staff)
        response = self.client.get("/api/invoices/")
        self.assertEqual(response.status_code, 403)
        leads = self.client.get("/api/leads/")
        self.assertEqual(leads.status_code, 200)
