from rest_framework import serializers

from apps.payments.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "order_number",
            "provider",
            "status",
            "amount",
            "currency",
            "phone",
            "merchant_request_id",
            "checkout_request_id",
            "receipt_number",
            "result_code",
            "result_description",
            "processed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RetryMpesaPaymentSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False, allow_blank=True)
