from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.common.models import Notification
from apps.common.utils import normalize_phone
from apps.orders.models import Order
from apps.orders.services import transition_order
from apps.payments.models import Payment
from apps.payments.mpesa import MpesaClient

logger = logging.getLogger(__name__)


def initiate_mpesa_payment(*, order: Order, phone: str) -> dict:
    payment = Payment.objects.create(
        order=order,
        provider=Payment.Provider.MPESA,
        amount=order.total,
        phone=normalize_phone(phone),
        raw_request={"order_number": order.number, "phone": normalize_phone(phone), "amount": str(order.total)},
    )
    client = MpesaClient()
    try:
        response = client.stk_push(
            phone=phone,
            amount=order.total,
            account_reference=order.number,
            transaction_desc=f"Payment for {order.number}",
        )
    except Exception as exc:
        logger.exception("M-Pesa STK push failed for order %s", order.number)
        payment.status = Payment.Status.FAILED
        payment.result_description = str(exc)
        payment.save(update_fields=["status", "result_description", "processed_at", "updated_at"])
        transition_order(order, Order.Status.CANCELLED, note="M-Pesa initiation failed; stock released.")
        raise

    payment.status = Payment.Status.PROCESSING
    payment.merchant_request_id = response.get("MerchantRequestID", "")
    payment.checkout_request_id = response.get("CheckoutRequestID", "")
    payment.raw_response = response
    payment.save(
        update_fields=[
            "status",
            "merchant_request_id",
            "checkout_request_id",
            "raw_response",
            "updated_at",
        ]
    )
    return {
        "id": payment.id,
        "status": payment.status,
        "merchant_request_id": payment.merchant_request_id,
        "checkout_request_id": payment.checkout_request_id,
        "customer_message": response.get("CustomerMessage") or response.get("ResponseDescription", ""),
    }


@transaction.atomic
def handle_mpesa_callback(payload: dict) -> Payment | None:
    callback = payload.get("Body", {}).get("stkCallback", {})
    merchant_request_id = callback.get("MerchantRequestID", "")
    checkout_request_id = callback.get("CheckoutRequestID", "")
    result_code = str(callback.get("ResultCode", ""))
    result_description = callback.get("ResultDesc", "")

    payment = (
        Payment.objects.select_for_update()
        .select_related("order", "order__user")
        .filter(checkout_request_id=checkout_request_id)
        .first()
    )
    if not payment and merchant_request_id:
        payment = (
            Payment.objects.select_for_update()
            .select_related("order", "order__user")
            .filter(merchant_request_id=merchant_request_id)
            .first()
        )
    if not payment:
        logger.warning("Received M-Pesa callback for unknown checkout %s", checkout_request_id)
        return None

    if payment.status in {Payment.Status.SUCCESS, Payment.Status.FAILED, Payment.Status.CANCELLED}:
        return payment

    metadata = _callback_metadata(callback)
    payment.raw_callback = payload
    payment.result_code = result_code
    payment.result_description = result_description
    payment.receipt_number = metadata.get("MpesaReceiptNumber", "")
    payment.processed_at = timezone.now()

    if result_code == "0":
        payment.status = Payment.Status.SUCCESS
        payment.save()
        transition_order(payment.order, Order.Status.PAID, note="M-Pesa payment confirmed.")
        Notification.objects.create(
            user=payment.order.user,
            notification_type=Notification.NotificationType.PAYMENT,
            title=f"Payment received for {payment.order.number}",
            body="Your payment was confirmed successfully.",
            data={"order_id": payment.order_id, "payment_id": payment.id},
        )
    else:
        payment.status = Payment.Status.FAILED
        payment.save()
        if payment.order.status == Order.Status.PENDING_PAYMENT:
            transition_order(
                payment.order,
                Order.Status.CANCELLED,
                note=f"M-Pesa payment failed: {result_description}",
            )
        Notification.objects.create(
            user=payment.order.user,
            notification_type=Notification.NotificationType.PAYMENT,
            title=f"Payment failed for {payment.order.number}",
            body=result_description,
            data={"order_id": payment.order_id, "payment_id": payment.id},
        )
    return payment


def _callback_metadata(callback: dict) -> dict:
    items = callback.get("CallbackMetadata", {}).get("Item", [])
    return {item.get("Name"): item.get("Value") for item in items if item.get("Name")}
