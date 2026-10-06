"""Build the printable invoice payload shown on screen and export."""

from decimal import Decimal

from catalog.models import CompanyProfile
from finance.services import invoice_amounts, invoice_effective_status


def _money(amount, code: str) -> str:
    value = Decimal(str(amount or 0))
    if code == "USD":
        return f"${value:,.2f}"
    return f"{code} {value:,.2f}"


def _amount_in_words(amount, currency_code: str) -> str:
    value = int(Decimal(str(amount or 0)))
    ones = [
        "",
        "ONE",
        "TWO",
        "THREE",
        "FOUR",
        "FIVE",
        "SIX",
        "SEVEN",
        "EIGHT",
        "NINE",
        "TEN",
        "ELEVEN",
        "TWELVE",
        "THIRTEEN",
        "FOURTEEN",
        "FIFTEEN",
        "SIXTEEN",
        "SEVENTEEN",
        "EIGHTEEN",
        "NINETEEN",
    ]
    tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]

    def chunk(n: int) -> str:
        if n < 20:
            return ones[n]
        if n < 100:
            return f"{tens[n // 10]}{' ' + ones[n % 10] if n % 10 else ''}".strip()
        if n < 1000:
            return f"{ones[n // 100]} HUNDRED{' ' + chunk(n % 100) if n % 100 else ''}".strip()
        if n < 1_000_000:
            rest = chunk(n % 1000)
            return f"{chunk(n // 1000)} THOUSAND{' ' + rest if rest else ''}".strip()
        rest = chunk(n % 1_000_000)
        return f"{chunk(n // 1_000_000)} MILLION{' ' + rest if rest else ''}".strip()

    label = "DOLLARS" if currency_code == "USD" else currency_code
    return f"{chunk(value)} {label} ONLY"


def default_line_title(booking) -> str:
    nights = max(booking.safari_days - 1, 1)
    places = ", ".join(item.name for item in booking.destinations.all()) or "Tanzania"
    return f"{booking.safari_days} DAYS {nights} NIGHTS {places.upper()} SAFARI"


def default_line_description(booking) -> str:
    parts = [
        f"For {booking.adults} adult{'s' if booking.adults != 1 else ''}",
        f"{booking.children} child{'ren' if booking.children != 1 else ''}" if booking.children else "",
        f"from {booking.start_date} to {booking.end_date}",
    ]
    places = ", ".join(item.name for item in booking.destinations.all())
    if places:
        parts.append(f"visiting {places}")
    stays = list(booking.accommodations.select_related("hotel", "vendor").all())
    if stays:
        lodges = "; ".join(f"{stay.hotel.name} ({stay.vendor.name})" for stay in stays)
        parts.append(f"stays: {lodges}")
    parts.append("Includes accommodation, park fees, meals, private safari vehicle and transfers as agreed.")
    return ". ".join(item for item in parts if item)


def _bank_row(bank):
    return {
        "currency_code": bank.currency.code if getattr(bank, "currency_id", None) else "",
        "account_name": bank.account_name,
        "account_number": bank.account_number,
        "iban": bank.iban or "N/A",
        "swift": bank.swift,
        "bank_name": bank.bank_name,
        "branch": bank.branch,
        "branch_code": bank.branch_code,
        "correspondent": bank.correspondent,
        "correspondent_swift": bank.correspondent_swift,
    }


def _legacy_bank_row(company):
    return {
        "currency_code": "",
        "account_name": company.bank_account_name or company.name,
        "account_number": company.bank_account_number,
        "iban": company.bank_iban or "N/A",
        "swift": company.bank_swift,
        "bank_name": company.bank_name,
        "branch": company.bank_branch,
        "branch_code": company.bank_branch_code,
        "correspondent": company.bank_correspondent,
        "correspondent_swift": company.bank_correspondent_swift,
    }


def company_banks_for_invoice(company, currency=None):
    rows = [_bank_row(bank) for bank in company.banks.select_related("currency").all()]
    if not rows:
        if company.bank_account_number or company.bank_name or company.bank_account_name:
            return [_legacy_bank_row(company)]
        return []
    if currency:
        code = currency.code
        matching = [row for row in rows if row["currency_code"] == code]
        if matching:
            others = [row for row in rows if row["currency_code"] != code]
            return matching + others
    return rows


def invoice_document(invoice, request=None) -> dict:
    booking = invoice.booking
    client = invoice.client
    company = CompanyProfile.load()
    amounts = invoice_amounts(invoice)
    qty = invoice.quantity or max(booking.adults, 1)
    total = Decimal(str(invoice.total_amount))
    rate = (total / qty).quantize(Decimal("0.01")) if qty else total

    consultant = booking.assigned_to
    payments = [
        {
            "date": payment.paid_on.isoformat(),
            "mode": payment.payment_method.name if payment.payment_method_id else "Payment",
            "amount": str(payment.amount),
            "amount_display": _money(payment.amount, payment.currency.code),
            "account": payment.payment_method.name if payment.payment_method_id else "",
            "reference": payment.reference,
        }
        for payment in invoice.payments.select_related("currency", "payment_method").all()
    ]

    from catalog.logo import logo_variants
    from catalog.media_urls import browser_media_url

    variants = logo_variants(company)
    logo = variants.get("logo_wide_url") or ""
    if not logo and company.logo:
        logo = browser_media_url(company.logo.url)

    banks = company_banks_for_invoice(company, invoice.currency)
    primary = banks[0] if banks else None

    status = invoice_effective_status(invoice)
    paid_label = "Paid" if status == "paid" else "Partially paid" if status == "partially_paid" else ""

    return {
        "number": invoice.number,
        "invoice_date": invoice.invoice_date.isoformat(),
        "due_date": invoice.due_date.isoformat(),
        "status": invoice.status,
        "effective_status": status,
        "paid_badge": paid_label,
        "client_name": client.full_name,
        "attention_to": invoice.attention_to or client.full_name,
        "contact_person": invoice.contact_person or client.full_name,
        "consultant_name": (consultant.full_name or consultant.email) if consultant else "",
        "line_title": invoice.line_title or default_line_title(booking),
        "line_description": invoice.line_description or default_line_description(booking),
        "quantity": qty,
        "rate": str(rate),
        "rate_display": _money(rate, invoice.currency.code),
        "total_amount": str(invoice.total_amount),
        "total_display": _money(invoice.total_amount, invoice.currency.code),
        "amount_paid": str(amounts["paid"]),
        "amount_paid_display": _money(amounts["paid"], invoice.currency.code),
        "balance": str(amounts["balance"]),
        "balance_display": _money(amounts["balance"], invoice.currency.code),
        "total_in_words": _amount_in_words(invoice.total_amount, invoice.currency.code),
        "payment_terms": invoice.payment_terms,
        "notes": invoice.notes,
        "currency_code": invoice.currency.code,
        "booking_reference": booking.reference,
        "company": {
            "name": company.name,
            "email": company.email,
            "phone": company.phone,
            "address": company.address,
            "tin_number": company.tin_number,
            "logo_url": logo,
            "banks": banks,
            "bank_account_name": primary["account_name"] if primary else (company.bank_account_name or company.name),
            "bank_account_number": primary["account_number"] if primary else company.bank_account_number,
            "bank_iban": primary["iban"] if primary else (company.bank_iban or "N/A"),
            "bank_swift": primary["swift"] if primary else company.bank_swift,
            "bank_name": primary["bank_name"] if primary else company.bank_name,
            "bank_branch": primary["branch"] if primary else company.bank_branch,
            "bank_branch_code": primary["branch_code"] if primary else company.bank_branch_code,
            "bank_correspondent": primary["correspondent"] if primary else company.bank_correspondent,
            "bank_correspondent_swift": primary["correspondent_swift"] if primary else company.bank_correspondent_swift,
            "invoice_terms": company.invoice_terms,
            "invoice_footer": company.invoice_footer,
        },
        "client": {
            "full_name": client.full_name,
            "email": client.email,
            "phone": client.phone or client.whatsapp,
            "country": client.country,
            "city": client.city,
            "address": client.address,
        },
        "payments": payments,
    }
