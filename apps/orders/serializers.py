from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.catalog.models import ProductVariant
from apps.catalog.serializers import ProductListSerializer
from apps.orders.models import Order, OrderItem, OrderStatusHistory

User = get_user_model()


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "variant",
            "product_name",
            "variant_sku",
            "size",
            "color",
            "quantity",
            "unit_price",
            "line_total",
        ]
        read_only_fields = fields


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name", read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ["id", "status", "note", "actor_name", "created_at"]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    latest_payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "number",
            "status",
            "email",
            "phone",
            "shipping_full_name",
            "shipping_phone",
            "shipping_line1",
            "shipping_line2",
            "shipping_city",
            "shipping_county",
            "shipping_country",
            "shipping_postal_code",
            "subtotal",
            "shipping_amount",
            "discount_amount",
            "total",
            "customer_note",
            "admin_note",
            "courier_name",
            "tracking_number",
            "tracking_url",
            "paid_at",
            "cancelled_at",
            "delivered_at",
            "latest_payment_status",
            "items",
            "status_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_latest_payment_status(self, obj):
        payment = obj.payments.order_by("-created_at").first()
        return payment.status if payment else None


class CheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField(required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    shipping_full_name = serializers.CharField(required=False)
    shipping_phone = serializers.CharField(required=False)
    shipping_line1 = serializers.CharField(required=False)
    shipping_line2 = serializers.CharField(required=False, allow_blank=True)
    shipping_city = serializers.CharField(required=False)
    shipping_county = serializers.CharField(required=False, allow_blank=True)
    shipping_country = serializers.CharField(required=False, default="Kenya")
    shipping_postal_code = serializers.CharField(required=False, allow_blank=True)
    shipping_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    customer_note = serializers.CharField(required=False, allow_blank=True)
    mpesa_phone = serializers.CharField(required=False, allow_blank=True)


class ManualOrderItemSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)


class ManualOrderCreateSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    status = serializers.ChoiceField(choices=Order.Status.choices, required=False, default=Order.Status.PAID)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    shipping_full_name = serializers.CharField()
    shipping_phone = serializers.CharField()
    shipping_line1 = serializers.CharField()
    shipping_line2 = serializers.CharField(required=False, allow_blank=True)
    shipping_city = serializers.CharField()
    shipping_county = serializers.CharField(required=False, allow_blank=True)
    shipping_country = serializers.CharField(required=False, default="Kenya")
    shipping_postal_code = serializers.CharField(required=False, allow_blank=True)
    shipping_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    customer_note = serializers.CharField(required=False, allow_blank=True)
    admin_note = serializers.CharField(required=False, allow_blank=True)
    items = ManualOrderItemSerializer(many=True)


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
    courier_name = serializers.CharField(required=False, allow_blank=True)
    tracking_number = serializers.CharField(required=False, allow_blank=True)
    tracking_url = serializers.URLField(required=False, allow_blank=True)
