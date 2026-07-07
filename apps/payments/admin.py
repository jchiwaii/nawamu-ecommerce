from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["order", "provider", "status", "amount", "phone", "receipt_number", "processed_at", "created_at"]
    list_filter = ["provider", "status", "created_at", "processed_at"]
    search_fields = [
        "order__number",
        "phone",
        "merchant_request_id",
        "checkout_request_id",
        "receipt_number",
        "result_description",
    ]
    readonly_fields = [
        "order",
        "provider",
        "amount",
        "currency",
        "phone",
        "merchant_request_id",
        "checkout_request_id",
        "receipt_number",
        "result_code",
        "result_description",
        "raw_request",
        "raw_response",
        "raw_callback",
        "processed_at",
        "created_at",
        "updated_at",
    ]
