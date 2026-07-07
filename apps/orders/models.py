from __future__ import annotations

import random
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.common.models import TimeStampedModel
from apps.common.utils import money


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "Pending payment"
        PAID = "paid", "Paid"
        PROCESSING = "processing", "Processing"
        PACKED = "packed", "Packed"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    number = models.CharField(max_length=32, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING_PAYMENT, db_index=True)
    email = models.EmailField()
    phone = models.CharField(max_length=32)
    shipping_full_name = models.CharField(max_length=160)
    shipping_phone = models.CharField(max_length=32)
    shipping_line1 = models.CharField(max_length=255)
    shipping_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=120)
    shipping_county = models.CharField(max_length=120, blank=True)
    shipping_country = models.CharField(max_length=80, default="Kenya")
    shipping_postal_code = models.CharField(max_length=32, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    shipping_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    customer_note = models.TextField(blank=True)
    admin_note = models.TextField(blank=True)
    courier_name = models.CharField(max_length=120, blank=True)
    tracking_number = models.CharField(max_length=120, blank=True)
    tracking_url = models.URLField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    stock_released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["tracking_number"]),
        ]

    def __str__(self) -> str:
        return self.number

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = generate_order_number()
        self.subtotal = money(self.subtotal)
        self.shipping_amount = money(self.shipping_amount)
        self.discount_amount = money(self.discount_amount)
        self.total = money(self.total or (self.subtotal + self.shipping_amount - self.discount_amount))
        super().save(*args, **kwargs)


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    product_name = models.CharField(max_length=180)
    variant_sku = models.CharField(max_length=80)
    size = models.CharField(max_length=32)
    color = models.CharField(max_length=80)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.product_name} x {self.quantity}"

    def save(self, *args, **kwargs):
        self.unit_price = money(self.unit_price)
        self.line_total = money(self.line_total or self.unit_price * self.quantity)
        super().save(*args, **kwargs)


class OrderStatusHistory(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    status = models.CharField(max_length=24, choices=Order.Status.choices)
    note = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_status_updates",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "order status histories"

    def __str__(self) -> str:
        return f"{self.order.number}: {self.status}"


def generate_order_number() -> str:
    date_part = timezone.now().strftime("%Y%m%d")
    for _ in range(20):
        candidate = f"ORD-{date_part}-{random.randint(100000, 999999)}"
        if not Order.objects.filter(number=candidate).exists():
            return candidate
    return f"ORD-{date_part}-{timezone.now().strftime('%H%M%S%f')}"
