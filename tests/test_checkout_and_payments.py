import pytest

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product
from apps.orders.models import Order
from apps.payments.models import Payment


@pytest.mark.django_db
def test_checkout_decrements_variant_stock_and_starts_mpesa(api_client, user, product_variant):
    cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=cart, variant=product_variant, quantity=2)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        "/api/checkout/",
        {
            "shipping_full_name": "Customer One",
            "shipping_phone": "0712345678",
            "shipping_line1": "Moi Avenue",
            "shipping_city": "Nairobi",
            "mpesa_phone": "0712345678",
        },
        format="json",
    )

    assert response.status_code == 201
    product_variant.refresh_from_db()
    assert product_variant.stock_quantity == 3
    order = Order.objects.get(number=response.data["order"]["number"])
    assert order.status == Order.Status.PENDING_PAYMENT
    payment = Payment.objects.get(order=order)
    assert payment.status == Payment.Status.PROCESSING
    assert payment.checkout_request_id


@pytest.mark.django_db
def test_checkout_rejects_oversell_without_changing_stock(api_client, user, product_variant):
    cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=cart, variant=product_variant, quantity=6)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        "/api/checkout/",
        {
            "shipping_full_name": "Customer One",
            "shipping_phone": "0712345678",
            "shipping_line1": "Moi Avenue",
            "shipping_city": "Nairobi",
        },
        format="json",
    )

    assert response.status_code == 400
    product_variant.refresh_from_db()
    assert product_variant.stock_quantity == 5
    assert Order.objects.count() == 0


@pytest.mark.django_db
def test_mpesa_success_callback_marks_order_paid_once(api_client, user, product_variant):
    cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=cart, variant=product_variant, quantity=1)
    api_client.force_authenticate(user=user)
    checkout = api_client.post(
        "/api/checkout/",
        {
            "shipping_full_name": "Customer One",
            "shipping_phone": "0712345678",
            "shipping_line1": "Moi Avenue",
            "shipping_city": "Nairobi",
        },
        format="json",
    )
    order = Order.objects.get(number=checkout.data["order"]["number"])
    payment = Payment.objects.get(order=order)

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": payment.merchant_request_id,
                "CheckoutRequestID": payment.checkout_request_id,
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": 2500},
                        {"Name": "MpesaReceiptNumber", "Value": "RCP123"},
                    ]
                },
            }
        }
    }

    api_client.force_authenticate(user=None)
    response = api_client.post("/api/payments/mpesa/callback/", payload, format="json")
    duplicate = api_client.post("/api/payments/mpesa/callback/", payload, format="json")

    assert response.status_code == 200
    assert duplicate.status_code == 200
    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    product = Product.objects.get(pk=product_variant.product_id)
    assert product.sold_count == 1
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESS
    assert payment.receipt_number == "RCP123"
