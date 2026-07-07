import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import ProductVariant
from apps.common.models import TimeStampedModel
from apps.common.utils import money


class Cart(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CONVERTED = "converted", "Converted"
        ABANDONED = "abandoned", "Abandoned"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="carts",
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self) -> str:
        owner = self.user.email if self.user else self.token
        return f"Cart {owner}"

    @property
    def subtotal(self):
        return money(sum(item.line_total for item in self.items.select_related("variant", "variant__product")))

    @property
    def item_count(self) -> int:
        return sum(item.quantity for item in self.items.all())


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="cart_items")
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["cart", "variant"], name="unique_cart_variant")]
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.variant.sku} x {self.quantity}"

    @property
    def unit_price(self):
        return self.variant.price

    @property
    def line_total(self):
        return money(self.unit_price * self.quantity)
