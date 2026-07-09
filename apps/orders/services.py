from __future__ import annotations

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import Address, User
from apps.cart.models import Cart
from apps.catalog.models import Product, ProductVariant, StockMovement
from apps.common.models import Notification
from apps.common.utils import money, normalize_phone
from apps.orders.models import Order, OrderItem, OrderStatusHistory


class CheckoutError(ValueError):
    pass


@transaction.atomic
def create_order_from_cart(*, user: User, cart: Cart, checkout_data: dict) -> Order:
    items = list(cart.items.select_related("variant", "variant__product").select_for_update())
    if not items:
        raise CheckoutError("Cart is empty.")
    if cart.status != Cart.Status.ACTIVE:
        raise CheckoutError("Cart is not active.")
    if cart.user_id and cart.user_id != user.id:
        raise CheckoutError("Cart does not belong to this user.")

    try:
        address = _resolve_address(user, checkout_data)
    except Address.DoesNotExist as exc:
        raise CheckoutError("Selected shipping address was not found.") from exc
    variant_ids = [item.variant_id for item in items]
    locked_variants = {
        variant.id: variant
        for variant in ProductVariant.objects.select_for_update()
        .select_related("product")
        .filter(id__in=variant_ids, is_active=True, product__is_active=True)
    }

    subtotal = money(0)
    for item in items:
        variant = locked_variants.get(item.variant_id)
        if not variant:
            raise CheckoutError(f"{item.variant.sku} is no longer available.")
        if item.quantity > variant.stock_quantity:
            raise CheckoutError(f"Only {variant.stock_quantity} left for {variant.sku}.")
        subtotal += money(variant.price * item.quantity)

    shipping_amount = money(checkout_data.get("shipping_amount", 0))
    discount_amount = money(checkout_data.get("discount_amount", 0))
    total = money(subtotal + shipping_amount - discount_amount)

    order = Order.objects.create(
        user=user,
        fulfillment_method=checkout_data.get("fulfillment_method", Order.FulfillmentMethod.DELIVERY),
        delivery_location=checkout_data.get("delivery_location", ""),
        preferred_delivery_window=checkout_data.get("preferred_delivery_window", ""),
        pickup_location=checkout_data.get("pickup_location", ""),
        email=checkout_data.get("email") or user.email,
        phone=normalize_phone(checkout_data.get("phone") or user.phone or address.get("phone", "")),
        shipping_full_name=address["full_name"],
        shipping_phone=normalize_phone(address["phone"]),
        shipping_line1=address["line1"],
        shipping_line2=address.get("line2", ""),
        shipping_city=address["city"],
        shipping_county=address.get("county", ""),
        shipping_country=address.get("country", "Kenya"),
        shipping_postal_code=address.get("postal_code", ""),
        subtotal=subtotal,
        shipping_amount=shipping_amount,
        discount_amount=discount_amount,
        total=total,
        customer_note=checkout_data.get("customer_note", ""),
    )
    OrderStatusHistory.objects.create(order=order, status=order.status, note="Order created from cart.")

    for item in items:
        variant = locked_variants[item.variant_id]
        line_total = money(variant.price * item.quantity)
        OrderItem.objects.create(
            order=order,
            product=variant.product,
            variant=variant,
            product_name=variant.product.name,
            variant_sku=variant.sku,
            size=variant.size,
            color=variant.color,
            quantity=item.quantity,
            unit_price=variant.price,
            line_total=line_total,
        )
        variant.stock_quantity -= item.quantity
        variant.save(update_fields=["stock_quantity", "updated_at"])
        StockMovement.objects.create(
            variant=variant,
            movement_type=StockMovement.MovementType.SALE,
            quantity=-item.quantity,
            reason=f"Reserved/decremented for order {order.number}",
            order=order,
        )

    cart.status = Cart.Status.CONVERTED
    cart.save(update_fields=["status", "updated_at"])
    Notification.objects.create(
        user=user,
        notification_type=Notification.NotificationType.ORDER,
        title=f"Order {order.number} created",
        body="Your order is waiting for payment.",
        data={"order_id": order.id, "order_number": order.number},
    )
    return order


@transaction.atomic
def create_manual_order(*, actor: User, user: User, items_data: list[dict], order_data: dict) -> Order:
    if not actor.is_staff:
        raise CheckoutError("Only staff can create manual orders.")
    if not items_data:
        raise CheckoutError("At least one item is required.")

    locked_variants = {
        variant.id: variant
        for variant in ProductVariant.objects.select_for_update()
        .select_related("product")
        .filter(id__in=[item["variant"].id for item in items_data], is_active=True, product__is_active=True)
    }
    subtotal = money(0)
    for item_data in items_data:
        variant = locked_variants.get(item_data["variant"].id)
        quantity = item_data["quantity"]
        if not variant:
            raise CheckoutError("One or more variants are unavailable.")
        if quantity > variant.stock_quantity:
            raise CheckoutError(f"Only {variant.stock_quantity} left for {variant.sku}.")
        subtotal += money(variant.price * quantity)

    shipping_amount = money(order_data.get("shipping_amount", 0))
    discount_amount = money(order_data.get("discount_amount", 0))
    status = order_data.get("status") or Order.Status.PAID
    order = Order.objects.create(
        user=user,
        status=status,
        fulfillment_method=order_data.get("fulfillment_method", Order.FulfillmentMethod.DELIVERY),
        delivery_location=order_data.get("delivery_location", ""),
        preferred_delivery_window=order_data.get("preferred_delivery_window", ""),
        pickup_location=order_data.get("pickup_location", ""),
        email=order_data.get("email") or user.email,
        phone=normalize_phone(order_data.get("phone") or user.phone),
        shipping_full_name=order_data["shipping_full_name"],
        shipping_phone=normalize_phone(order_data["shipping_phone"]),
        shipping_line1=order_data["shipping_line1"],
        shipping_line2=order_data.get("shipping_line2", ""),
        shipping_city=order_data["shipping_city"],
        shipping_county=order_data.get("shipping_county", ""),
        shipping_country=order_data.get("shipping_country", "Kenya"),
        shipping_postal_code=order_data.get("shipping_postal_code", ""),
        subtotal=subtotal,
        shipping_amount=shipping_amount,
        discount_amount=discount_amount,
        total=money(subtotal + shipping_amount - discount_amount),
        customer_note=order_data.get("customer_note", ""),
        admin_note=order_data.get("admin_note", ""),
        paid_at=timezone.now() if status != Order.Status.PENDING_PAYMENT else None,
    )
    OrderStatusHistory.objects.create(order=order, status=order.status, actor=actor, note="Manual staff order created.")

    for item_data in items_data:
        variant = locked_variants[item_data["variant"].id]
        quantity = item_data["quantity"]
        OrderItem.objects.create(
            order=order,
            product=variant.product,
            variant=variant,
            product_name=variant.product.name,
            variant_sku=variant.sku,
            size=variant.size,
            color=variant.color,
            quantity=quantity,
            unit_price=variant.price,
            line_total=money(variant.price * quantity),
        )
        variant.stock_quantity -= quantity
        variant.save(update_fields=["stock_quantity", "updated_at"])
        StockMovement.objects.create(
            variant=variant,
            movement_type=StockMovement.MovementType.SALE,
            quantity=-quantity,
            reason=f"Manual order {order.number}",
            order=order,
            created_by=actor,
        )
    if order.status != Order.Status.PENDING_PAYMENT:
        _increment_sales(order)
    return order


@transaction.atomic
def transition_order(order: Order, status: str, *, actor: User | None = None, note: str = "") -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    previous_status = order.status
    order.status = status
    now = timezone.now()
    if status == Order.Status.PAID and not order.paid_at:
        order.paid_at = now
    if status == Order.Status.CANCELLED and not order.cancelled_at:
        order.cancelled_at = now
    if status == Order.Status.DELIVERED and not order.delivered_at:
        order.delivered_at = now
    order.save()
    OrderStatusHistory.objects.create(order=order, status=status, actor=actor, note=note)
    if previous_status != Order.Status.PAID and status == Order.Status.PAID:
        _increment_sales(order)
    if status in {Order.Status.CANCELLED, Order.Status.REFUNDED}:
        release_order_stock(order, actor=actor, reason=f"Order {status}")
    Notification.objects.create(
        user=order.user,
        notification_type=Notification.NotificationType.ORDER,
        title=f"Order {order.number} updated",
        body=f"Your order status is now {order.get_status_display()}.",
        data={"order_id": order.id, "order_number": order.number, "status": status},
    )
    return order


@transaction.atomic
def mark_order_paid(order: Order, *, note: str = "Payment confirmed.") -> Order:
    if order.status == Order.Status.PAID:
        return order
    return transition_order(order, Order.Status.PAID, note=note)


@transaction.atomic
def release_order_stock(order: Order, *, actor: User | None = None, reason: str = "Stock released") -> None:
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.stock_released_at:
        return
    for item in order.items.select_related("variant").select_for_update():
        if not item.variant_id:
            continue
        ProductVariant.objects.filter(pk=item.variant_id).update(stock_quantity=F("stock_quantity") + item.quantity)
        StockMovement.objects.create(
            variant=item.variant,
            movement_type=StockMovement.MovementType.RELEASE,
            quantity=item.quantity,
            reason=reason,
            order=order,
            created_by=actor,
        )
    order.stock_released_at = timezone.now()
    order.save(update_fields=["stock_released_at", "updated_at"])


def _increment_sales(order: Order) -> None:
    for item in order.items.all():
        Product.objects.filter(pk=item.product_id).update(sold_count=F("sold_count") + item.quantity)


def _resolve_address(user: User, checkout_data: dict) -> dict:
    if checkout_data.get("fulfillment_method") == Order.FulfillmentMethod.PICKUP:
        pickup_location = checkout_data.get("pickup_location") or "Nawamu pickup point, Ngara, Nairobi"
        return {
            "full_name": checkout_data.get("shipping_full_name") or user.display_name,
            "phone": checkout_data.get("shipping_phone") or user.phone,
            "line1": pickup_location,
            "line2": "",
            "city": "Nairobi",
            "county": "Nairobi",
            "country": "Kenya",
            "postal_code": "",
        }

    address_id = checkout_data.get("shipping_address_id")
    if address_id:
        address = Address.objects.get(pk=address_id, user=user)
        return {
            "full_name": address.full_name,
            "phone": address.phone,
            "line1": address.line1,
            "line2": address.line2,
            "city": address.city,
            "county": address.county,
            "country": address.country,
            "postal_code": address.postal_code,
        }
    required_fields = ["shipping_full_name", "shipping_phone", "shipping_line1", "shipping_city"]
    missing = [field for field in required_fields if not checkout_data.get(field)]
    if missing:
        raise CheckoutError(f"Missing required shipping fields: {', '.join(missing)}")
    return {
        "full_name": checkout_data["shipping_full_name"],
        "phone": checkout_data["shipping_phone"],
        "line1": checkout_data["shipping_line1"],
        "line2": checkout_data.get("shipping_line2", ""),
        "city": checkout_data["shipping_city"],
        "county": checkout_data.get("shipping_county", ""),
        "country": checkout_data.get("shipping_country", "Kenya"),
        "postal_code": checkout_data.get("shipping_postal_code", ""),
    }
