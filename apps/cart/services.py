from __future__ import annotations

from uuid import UUID

from django.db import transaction

from apps.cart.models import Cart, CartItem
from apps.catalog.models import ProductVariant


def get_cart_for_request(request) -> Cart:
    token = request.headers.get("X-Cart-Token") or request.query_params.get("cart_token") or request.data.get("cart_token")
    user = request.user if request.user.is_authenticated else None

    if user:
        cart, _ = Cart.objects.get_or_create(user=user, status=Cart.Status.ACTIVE)
        if token:
            try:
                anonymous_cart = Cart.objects.get(token=UUID(str(token)), user__isnull=True, status=Cart.Status.ACTIVE)
            except (Cart.DoesNotExist, ValueError):
                anonymous_cart = None
            if anonymous_cart:
                merge_carts(anonymous_cart, cart)
        return cart

    if token:
        try:
            return Cart.objects.get(token=UUID(str(token)), status=Cart.Status.ACTIVE)
        except (Cart.DoesNotExist, ValueError):
            pass
    return Cart.objects.create()


@transaction.atomic
def merge_carts(source: Cart, target: Cart) -> Cart:
    if source.pk == target.pk:
        return target
    for item in source.items.select_for_update().select_related("variant"):
        target_item, created = CartItem.objects.get_or_create(
            cart=target,
            variant=item.variant,
            defaults={"quantity": item.quantity},
        )
        if not created:
            target_item.quantity += item.quantity
            target_item.save(update_fields=["quantity", "updated_at"])
    source.status = Cart.Status.CONVERTED
    source.save(update_fields=["status", "updated_at"])
    return target


@transaction.atomic
def add_item(cart: Cart, variant: ProductVariant, quantity: int) -> CartItem:
    quantity = max(int(quantity), 1)
    if quantity > variant.stock_quantity:
        raise ValueError("Requested quantity exceeds available stock.")
    item, created = CartItem.objects.select_for_update().get_or_create(
        cart=cart,
        variant=variant,
        defaults={"quantity": quantity},
    )
    if not created:
        new_quantity = item.quantity + quantity
        if new_quantity > variant.stock_quantity:
            raise ValueError("Requested quantity exceeds available stock.")
        item.quantity = new_quantity
        item.save(update_fields=["quantity", "updated_at"])
    cart.save(update_fields=["updated_at"])
    return item


@transaction.atomic
def update_item_quantity(item: CartItem, quantity: int) -> CartItem | None:
    quantity = int(quantity)
    if quantity <= 0:
        item.delete()
        return None
    variant = ProductVariant.objects.select_for_update().get(pk=item.variant_id)
    if quantity > variant.stock_quantity:
        raise ValueError("Requested quantity exceeds available stock.")
    item.quantity = quantity
    item.save(update_fields=["quantity", "updated_at"])
    item.cart.save(update_fields=["updated_at"])
    return item
