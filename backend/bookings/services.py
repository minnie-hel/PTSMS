from decimal import Decimal

from django.utils import timezone

from bookings.models import Booking


def resolved_safari_status(booking):
    if (
        booking.overall_status in (Booking.Overall.CONFIRMED, Booking.Overall.COMPLETED)
        and booking.start_date
        and booking.end_date
    ):
        today = timezone.localdate()
        if booking.overall_status == Booking.Overall.COMPLETED or today > booking.end_date:
            return Booking.SafariStatus.SAFARI_DONE
        if booking.start_date <= today <= booking.end_date:
            return Booking.SafariStatus.SAFARI_IN_PROGRESS
        return Booking.SafariStatus.WAITING_FOR_SAFARI
    if booking.overall_status == Booking.Overall.COMPLETED:
        return Booking.SafariStatus.SAFARI_DONE
    return booking.safari_status


def stay_paid(stay):
    return sum((payment.amount_applied for payment in stay.vendor_payments.all()), Decimal("0"))


def stay_payment_status(stay):
    paid = stay_paid(stay)
    owed = stay.agreed_cost or Decimal("0")
    if paid <= 0:
        return Booking.PayStatus.NOT_PAID
    if owed > 0 and paid >= owed:
        return Booking.PayStatus.FULLY_PAID
    return Booking.PayStatus.PARTIAL_PAID


def vendor_payment_summary(booking):
    stays = list(booking.accommodations.all())
    owed = {}
    paid = {}
    for stay in stays:
        code = stay.cost_currency.code if stay.cost_currency_id else None
        amount_owed = stay.agreed_cost or Decimal("0")
        amount_paid = stay_paid(stay)
        if code and amount_owed:
            owed[code] = owed.get(code, Decimal("0")) + amount_owed
        if code and amount_paid:
            paid[code] = paid.get(code, Decimal("0")) + amount_paid
    tracked = [stay for stay in stays if (stay.agreed_cost or 0) > 0]
    if not tracked:
        status = Booking.PayStatus.NOT_PAID
    elif all(stay_paid(stay) >= stay.agreed_cost for stay in tracked):
        status = Booking.PayStatus.FULLY_PAID
    elif any(stay_paid(stay) > 0 for stay in stays):
        status = Booking.PayStatus.PARTIAL_PAID
    else:
        status = Booking.PayStatus.NOT_PAID
    return {"owed": owed, "paid": paid, "status": status}
