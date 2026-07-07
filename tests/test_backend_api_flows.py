from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import site

from apps.accounts.models import Address
from apps.cart.models import Cart, CartItem
from apps.catalog.models import Brand, Category, Favorite, Product, ProductVariant, Review
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.support.models import SupportTicket


User = get_user_model()


@pytest.mark.django_db
def test_customer_auth_profile_and_address_flow(api_client):
    register = api_client.post(
        "/api/auth/register/",
        {
            "email": "new.customer@example.com",
            "password": "securepass123",
            "full_name": "New Customer",
            "phone": "0711222333",
        },
        format="json",
    )
    assert register.status_code == 201
    assert User.objects.filter(email="new.customer@example.com").exists()

    token = api_client.post(
        "/api/auth/token/",
        {"email": "new.customer@example.com", "password": "securepass123"},
        format="json",
    )
    assert token.status_code == 200
    assert token.data["access"]
    assert token.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
    me = api_client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["email"] == "new.customer@example.com"
    assert me.data["is_staff"] is False

    updated = api_client.patch(
        "/api/auth/me/",
        {"full_name": "New Customer Updated", "phone": "0799999999"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["full_name"] == "New Customer Updated"

    create_address = api_client.post(
        "/api/addresses/",
        {
            "address_type": "shipping",
            "full_name": "New Customer",
            "phone": "0711222333",
            "line1": "Kenyatta Avenue",
            "city": "Nairobi",
            "county": "Nairobi",
            "is_default": True,
        },
        format="json",
    )
    assert create_address.status_code == 201

    addresses = api_client.get("/api/addresses/")
    assert addresses.status_code == 200
    assert addresses.data["results"][0]["line1"] == "Kenyatta Avenue"


@pytest.mark.django_db
def test_catalog_browse_search_favorite_and_review_visibility(api_client, user, staff_user, product_variant):
    product = product_variant.product

    list_response = api_client.get("/api/products/", {"q": "best shoes of men"})
    assert list_response.status_code == 200
    assert [item["slug"] for item in list_response.data["results"]] == [product.slug]

    detail = api_client.get(f"/api/products/{product.slug}/")
    assert detail.status_code == 200
    assert detail.data["variants"][0]["sku"] == product_variant.sku
    product.refresh_from_db()
    assert product.view_count == 1

    unauth_favorite = api_client.post(f"/api/products/{product.slug}/favorite/")
    assert unauth_favorite.status_code in {401, 403}

    api_client.force_authenticate(user=user)
    favorite = api_client.post(f"/api/products/{product.slug}/favorite/")
    duplicate_favorite = api_client.post(f"/api/products/{product.slug}/favorite/")
    favorites = api_client.get("/api/favorites/")
    unfavorite = api_client.delete(f"/api/products/{product.slug}/favorite/")

    assert favorite.status_code == 201
    assert duplicate_favorite.status_code == 200
    assert favorites.status_code == 200
    assert favorites.data["results"][0]["product"] == product.id
    assert unfavorite.status_code == 204
    assert Favorite.objects.filter(user=user, product=product).count() == 0

    review = api_client.post(
        "/api/reviews/",
        {"product": product.id, "rating": 4, "title": "Clean shoe", "comment": "Comfortable for daily wear."},
        format="json",
    )
    assert review.status_code == 201
    review_id = review.data["id"]

    api_client.force_authenticate(user=None)
    public_reviews = api_client.get(f"/api/products/{product.slug}/reviews/")
    assert public_reviews.status_code == 200
    assert public_reviews.data["count"] == 0

    api_client.force_authenticate(user=staff_user)
    approve = api_client.post(f"/api/reviews/{review_id}/approve/")
    assert approve.status_code == 200

    api_client.force_authenticate(user=None)
    public_reviews = api_client.get(f"/api/products/{product.slug}/reviews/")
    assert public_reviews.data["count"] == 1
    product.refresh_from_db()
    assert product.rating_avg == 4


@pytest.mark.django_db
def test_anonymous_cart_merges_into_authenticated_checkout_and_tracks_order(api_client, user, product_variant):
    anonymous_cart = api_client.get("/api/cart/current/")
    assert anonymous_cart.status_code == 200
    cart_token = anonymous_cart.data["token"]

    anonymous_add = api_client.post(
        "/api/cart/add_item/",
        {"variant_id": product_variant.id, "quantity": 2},
        format="json",
        HTTP_X_CART_TOKEN=cart_token,
    )
    assert anonymous_add.status_code == 201
    assert anonymous_add.data["item_count"] == 2

    api_client.force_authenticate(user=user)
    merged = api_client.get("/api/cart/current/", HTTP_X_CART_TOKEN=cart_token)
    assert merged.status_code == 200
    assert merged.data["item_count"] == 2
    assert Cart.objects.get(token=cart_token).status == Cart.Status.CONVERTED

    checkout = api_client.post(
        "/api/checkout/",
        {
            "shipping_full_name": "Customer One",
            "shipping_phone": "0712345678",
            "shipping_line1": "Moi Avenue",
            "shipping_city": "Nairobi",
            "mpesa_phone": "0712345678",
            "customer_note": "Call before delivery.",
        },
        format="json",
    )
    assert checkout.status_code == 201
    assert checkout.data["order"]["total"] == "5000.00"
    assert checkout.data["payment"]["status"] == Payment.Status.PROCESSING

    product_variant.refresh_from_db()
    assert product_variant.stock_quantity == 3
    assert CartItem.objects.filter(cart__user=user, cart__status=Cart.Status.ACTIVE).count() == 0

    order_number = checkout.data["order"]["number"]
    order_detail = api_client.get(f"/api/orders/{order_number}/")
    tracking = api_client.get(f"/api/orders/{order_number}/track/")
    payments = api_client.get("/api/payments/")

    assert order_detail.status_code == 200
    assert order_detail.data["number"] == order_number
    assert tracking.status_code == 200
    assert tracking.data["status"] == Order.Status.PENDING_PAYMENT
    assert payments.status_code == 200
    assert payments.data["results"][0]["order"] == order_detail.data["id"]


@pytest.mark.django_db
def test_mpesa_failed_callback_cancels_order_and_releases_stock_once(api_client, user, product_variant):
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
    assert checkout.status_code == 201

    order = Order.objects.get(number=checkout.data["order"]["number"])
    payment = Payment.objects.get(order=order)
    product_variant.refresh_from_db()
    assert product_variant.stock_quantity == 4

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": payment.merchant_request_id,
                "CheckoutRequestID": payment.checkout_request_id,
                "ResultCode": 1032,
                "ResultDesc": "Request cancelled by user.",
            }
        }
    }

    api_client.force_authenticate(user=None)
    response = api_client.post("/api/payments/mpesa/callback/", payload, format="json")
    duplicate = api_client.post("/api/payments/mpesa/callback/", payload, format="json")

    assert response.status_code == 200
    assert duplicate.status_code == 200
    assert response.data["payment_id"] == payment.id

    order.refresh_from_db()
    payment.refresh_from_db()
    product_variant.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert payment.status == Payment.Status.FAILED
    assert product_variant.stock_quantity == 5
    assert order.stock_released_at is not None


@pytest.mark.django_db
def test_staff_admin_api_manual_order_status_and_dashboard_flow(api_client, user, staff_user, product_variant):
    api_client.force_authenticate(user=user)
    forbidden_users = api_client.get("/api/admin/users/")
    forbidden_order = api_client.post("/api/orders/", {}, format="json")
    assert forbidden_users.status_code == 403
    assert forbidden_order.status_code == 403

    api_client.force_authenticate(user=staff_user)
    users = api_client.get("/api/admin/users/", {"search": "customer"})
    assert users.status_code == 200
    assert any(item["email"] == user.email for item in users.data["results"])

    manual_order = api_client.post(
        "/api/orders/",
        {
            "user": user.id,
            "status": Order.Status.PAID,
            "shipping_full_name": "Customer One",
            "shipping_phone": "0712345678",
            "shipping_line1": "Kimathi Street",
            "shipping_city": "Nairobi",
            "items": [{"variant": product_variant.id, "quantity": 1}],
        },
        format="json",
    )
    assert manual_order.status_code == 201
    assert manual_order.data["status"] == Order.Status.PAID

    product_variant.refresh_from_db()
    assert product_variant.stock_quantity == 4

    order_number = manual_order.data["number"]
    update = api_client.post(
        f"/api/orders/{order_number}/update_status/",
        {
            "status": Order.Status.SHIPPED,
            "note": "Handed to courier.",
            "courier_name": "Nawamu Express",
            "tracking_number": "TRK-1001",
            "tracking_url": "https://tracking.example.com/TRK-1001",
        },
        format="json",
    )
    assert update.status_code == 200
    assert update.data["status"] == Order.Status.SHIPPED
    assert update.data["tracking_number"] == "TRK-1001"
    assert len(update.data["status_history"]) >= 2

    dashboard = api_client.get("/api/admin/dashboard/")
    assert dashboard.status_code == 200
    assert dashboard.data["metrics"]["orders_total"] == 1
    assert dashboard.data["metrics"]["revenue"] == Decimal("2500.00")
    assert dashboard.data["recent_orders"][0]["number"] == order_number


@pytest.mark.django_db
def test_support_ticket_anonymous_submission_staff_reply_assignment_and_resolution(api_client, staff_user):
    anonymous = api_client.post(
        "/api/support/tickets/",
        {
            "subject": "Need shoe sizing help",
            "email": "visitor@example.com",
            "phone": "0712000000",
            "category": "support",
            "priority": "normal",
            "message": "Which size should I choose?",
        },
        format="json",
    )
    assert anonymous.status_code == 201
    ticket_id = anonymous.data["id"]
    assert anonymous.data["messages"][0]["sender_type"] == "customer"

    unauth_list = api_client.get("/api/support/tickets/")
    assert unauth_list.status_code in {401, 403}

    api_client.force_authenticate(user=staff_user)
    staff_list = api_client.get("/api/support/tickets/")
    assert staff_list.status_code == 200
    assert staff_list.data["results"][0]["email"] == "visitor@example.com"

    assign = api_client.post(f"/api/support/tickets/{ticket_id}/assign/")
    reply = api_client.post(
        f"/api/support/tickets/{ticket_id}/reply/",
        {"body": "Please share your foot length in cm."},
        format="json",
    )
    resolve = api_client.post(f"/api/support/tickets/{ticket_id}/resolve/")

    assert assign.status_code == 200
    assert reply.status_code == 200
    assert reply.data["status"] == SupportTicket.Status.WAITING_CUSTOMER
    assert resolve.status_code == 200
    assert resolve.data["status"] == SupportTicket.Status.RESOLVED


@pytest.mark.django_db
def test_staff_can_manage_catalog_and_django_admin_pages_smoke(api_client, client, staff_user):
    api_client.force_authenticate(user=staff_user)

    category = api_client.post("/api/categories/", {"name": "Lifestyle Shoes"}, format="json")
    brand = api_client.post("/api/brands/", {"name": "Nawamu"}, format="json")
    assert category.status_code == 201
    assert brand.status_code == 201

    product = api_client.post(
        "/api/products/",
        {
            "name": "Nawamu Daily Sneaker",
            "description": "A minimal everyday shoe for clean outfits.",
            "category": category.data["id"],
            "brand": brand.data["id"],
            "gender": Product.Gender.UNISEX,
            "style": "lifestyle",
            "base_price": "3200.00",
            "is_featured": True,
        },
        format="json",
    )
    assert product.status_code == 201
    assert Product.objects.filter(name="Nawamu Daily Sneaker").exists()

    ProductVariant.objects.create(
        product=Product.objects.get(id=product.data["id"]),
        sku="NAW-DAILY-41-WHT",
        size="41",
        color="White",
        stock_quantity=9,
    )
    public_detail = api_client.get(f"/api/products/{product.data['slug']}/")
    assert public_detail.status_code == 200
    assert public_detail.data["variants"][0]["sku"] == "NAW-DAILY-41-WHT"

    client.force_login(staff_user)
    assert client.get("/admin/").status_code == 200
    for model in [User, Address, Category, Brand, Product, ProductVariant, Review, Order, Payment, SupportTicket]:
        assert model in site._registry
