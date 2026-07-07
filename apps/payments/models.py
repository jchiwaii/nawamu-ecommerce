from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel
from apps.common.utils import money


class Payment(TimeStampedModel):
    class Provider(models.TextChoices):
        MPESA = "mpesa", "M-Pesa"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=32, choices=Provider.choices, default=Provider.MPESA)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, default="KES")
    phone = models.CharField(max_length=32, blank=True)
    merchant_request_id = models.CharField(max_length=120, blank=True, db_index=True)
    checkout_request_id = models.CharField(max_length=120, blank=True, db_index=True)
    receipt_number = models.CharField(max_length=120, blank=True, db_index=True)
    result_code = models.CharField(max_length=32, blank=True)
    result_description = models.TextField(blank=True)
    raw_request = models.JSONField(default=dict, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    raw_callback = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["checkout_request_id"]),
            models.Index(fields=["merchant_request_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.provider} {self.order.number} {self.status}"

    def save(self, *args, **kwargs):
        self.amount = money(self.amount)
        if self.status in {self.Status.SUCCESS, self.Status.FAILED, self.Status.CANCELLED} and not self.processed_at:
            self.processed_at = timezone.now()
        super().save(*args, **kwargs)
