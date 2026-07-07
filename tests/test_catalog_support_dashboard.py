import pytest

from apps.catalog.models import Review
from apps.orders.models import Order, OrderItem
from apps.support.models import SupportTicket
from apps.common.models import Notification


@pytest.mark.django_db
def test_product_search_understands_mens_shoe_query(api_client, product_variant):
    response = api_client.get("/api/products/", {"q": "best shoes of men"})

    assert response.status_code == 200
    names = [item["name"] for item in response.data["results"]]
    assert product_variant.product.name in names


@pytest.mark.django_db
def test_verified_purchase_review_can_be_approved(api_client, user, staff_user, product_variant):
    order = Order.objects.create(
        user=user,
        status=Order.Status.DELIVERED,
        email=user.email,
        phone=user.phone,
        shipping_full_name="Customer One",
        shipping_phone=user.phone,
        shipping_line1="Moi Avenue",
        shipping_city="Nairobi",
        subtotal="2500.00",
        total="2500.00",
    )
    OrderItem.objects.create(
        order=order,
        product=product_variant.product,
        variant=product_variant,
        product_name=product_variant.product.name,
        variant_sku=product_variant.sku,
        size=product_variant.size,
        color=product_variant.color,
        quantity=1,
        unit_price="2500.00",
        line_total="2500.00",
    )
    api_client.force_authenticate(user=user)
    create_response = api_client.post(
        "/api/reviews/",
        {
            "product": product_variant.product.id,
            "rating": 5,
            "title": "Excellent",
            "comment": "Comfortable and exactly as described.",
        },
        format="json",
    )

    assert create_response.status_code == 201
    review = Review.objects.get(pk=create_response.data["id"])
    assert review.is_verified_purchase is True
    assert review.status == Review.Status.PENDING

    api_client.force_authenticate(user=staff_user)
    approve_response = api_client.post(f"/api/reviews/{review.id}/approve/")
    assert approve_response.status_code == 200
    product_variant.product.refresh_from_db()
    assert product_variant.product.rating_avg == 5


@pytest.mark.django_db
def test_authenticated_customer_can_create_support_ticket_without_retyping_email(api_client, user, staff_user):
    api_client.force_authenticate(user=user)
    create_response = api_client.post(
        "/api/support/tickets/",
        {
            "subject": "Where is my order?",
            "message": "I need help tracking my shoes.",
            "category": "orders",
        },
        format="json",
    )

    assert create_response.status_code == 201
    ticket = SupportTicket.objects.get(pk=create_response.data["id"])
    assert ticket.email == user.email
    assert ticket.messages.count() == 1

    api_client.force_authenticate(user=staff_user)
    reply_response = api_client.post(
        f"/api/support/tickets/{ticket.id}/reply/",
        {"body": "We are checking this for you."},
        format="json",
    )

    assert reply_response.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == SupportTicket.Status.WAITING_CUSTOMER
    assert Notification.objects.filter(user=user, notification_type=Notification.NotificationType.SUPPORT).exists()


@pytest.mark.django_db
def test_admin_dashboard_is_staff_only(api_client, user, staff_user):
    api_client.force_authenticate(user=user)
    denied = api_client.get("/api/admin/dashboard/")
    assert denied.status_code == 403

    api_client.force_authenticate(user=staff_user)
    allowed = api_client.get("/api/admin/dashboard/")
    assert allowed.status_code == 200
    assert "metrics" in allowed.data
