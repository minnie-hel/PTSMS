from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from bookings.models import Booking
from bookings.services import vendor_payment_summary
from finance.models import ClientPayment, Expense, Invoice, VendorPayment


def money(value):
    return value or Decimal("0")


def client_payment_summary(booking):
    paid = money(booking.payments.aggregate(total=Sum("amount_applied"))["total"])
    total = booking.total_amount or Decimal("0")
    balance = total - paid
    if paid <= 0:
        status = Booking.PayStatus.NOT_PAID
    elif balance <= 0:
        status = Booking.PayStatus.FULLY_PAID
    else:
        status = Booking.PayStatus.PARTIAL_PAID
    return {"paid": paid, "balance": balance if balance > 0 else Decimal("0"), "status": status}


def invoice_amounts(invoice):
    paid = money(invoice.payments.aggregate(total=Sum("amount_applied"))["total"])
    balance = (invoice.total_amount or Decimal("0")) - paid
    return {"paid": paid, "balance": balance if balance > 0 else Decimal("0")}


def invoice_effective_status(invoice):
    if invoice.status == Invoice.Status.CANCELLED:
        return "cancelled"
    if invoice.status == Invoice.Status.DRAFT:
        return "draft"
    amounts = invoice_amounts(invoice)
    if amounts["balance"] <= 0 and invoice.total_amount > 0:
        return "paid"
    if amounts["balance"] > 0 and invoice.due_date and invoice.due_date < timezone.localdate():
        return "overdue"
    if amounts["paid"] > 0:
        return "partially_paid"
    return "sent"


def add_bucket(buckets, code, amount):
    buckets[code] = buckets.get(code, Decimal("0")) + (amount or Decimal("0"))


def booking_profit(booking):
    fee_code = booking.currency.code
    hotel = {}
    other = {}
    for stay in booking.accommodations.all():
        if stay.agreed_cost and stay.cost_currency_id:
            add_bucket(hotel, stay.cost_currency.code, stay.agreed_cost)
    for expense in booking.expenses.all():
        add_bucket(other, expense.currency.code, expense.amount)
    same = hotel.get(fee_code, Decimal("0")) + other.get(fee_code, Decimal("0"))
    other_currencies = []
    for code, amount in {**hotel, **other}.items():
        if code != fee_code and amount:
            other_currencies.append({"currency": code, "amount": amount})
    return {
        "fee": {"currency": fee_code, "amount": booking.total_amount},
        "hotel_costs": [{"currency": code, "amount": amount} for code, amount in hotel.items()],
        "other_expenses": [{"currency": code, "amount": amount} for code, amount in other.items()],
        "gross_profit": {"currency": fee_code, "amount": booking.total_amount - same},
        "unconverted_costs": other_currencies,
        "vendor": vendor_payment_summary(booking),
    }


def cashbook(currency_code=None, method_id=None):
    rows = []
    payments = ClientPayment.objects.select_related("currency", "payment_method", "booking", "client")
    vendors = VendorPayment.objects.select_related(
        "currency", "payment_method", "accommodation__booking", "accommodation__vendor"
    )
    expenses = Expense.objects.select_related("currency", "payment_method", "booking", "category")
    if currency_code:
        payments = payments.filter(currency__code=currency_code)
        vendors = vendors.filter(currency__code=currency_code)
        expenses = expenses.filter(currency__code=currency_code)
    if method_id:
        payments = payments.filter(payment_method_id=method_id)
        vendors = vendors.filter(payment_method_id=method_id)
        expenses = expenses.filter(payment_method_id=method_id)
    for item in payments:
        rows.append(
            {
                "date": item.paid_on,
                "description": f"Client payment {item.client.full_name}",
                "category": "Client payment",
                "reference": item.reference,
                "money_in": item.amount,
                "money_out": Decimal("0"),
                "currency": item.currency.code,
                "method": item.payment_method.name if item.payment_method_id else "",
                "booking": item.booking.reference,
                "kind": "payment",
                "id": item.id,
            }
        )
    for item in vendors:
        rows.append(
            {
                "date": item.paid_on,
                "description": f"Hotel payment {item.accommodation.vendor.name}",
                "category": "Vendor payment",
                "reference": item.reference,
                "money_in": Decimal("0"),
                "money_out": item.amount,
                "currency": item.currency.code,
                "method": item.payment_method.name if item.payment_method_id else "",
                "booking": item.accommodation.booking.reference,
                "kind": "vendor_payment",
                "id": item.id,
            }
        )
    for item in expenses:
        rows.append(
            {
                "date": item.spent_on,
                "description": item.description or "Expense",
                "category": item.category.name if item.category_id else "Expense",
                "reference": item.reference,
                "money_in": Decimal("0"),
                "money_out": item.amount,
                "currency": item.currency.code,
                "method": item.payment_method.name if item.payment_method_id else "",
                "booking": item.booking.reference if item.booking_id else "",
                "kind": "expense",
                "id": item.id,
            }
        )
    rows.sort(key=lambda row: (row["date"], row["kind"], row["id"]))
    balances = {}
    books = {}
    for row in rows:
        code = row["currency"]
        balances[code] = balances.get(code, Decimal("0")) + row["money_in"] - row["money_out"]
        row["balance"] = balances[code]
        books.setdefault(code, []).append(row)
    return {"balances": balances, "books": books}
