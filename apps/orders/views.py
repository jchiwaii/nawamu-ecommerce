from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.services import get_cart_for_request
from apps.common.permissions import IsStaff
from apps.orders.models import Order
from apps.orders.serializers import (
    CheckoutSerializer,
    ManualOrderCreateSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
)
from apps.orders.services import CheckoutError, create_manual_order, create_order_from_cart, transition_order
from apps.payments.services import initiate_mpesa_payment


class CheckoutAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = get_cart_for_request(request)
        try:
            order = create_order_from_cart(user=request.user, cart=cart, checkout_data=serializer.validated_data)
            payment = initiate_mpesa_payment(
                order=order,
                phone=serializer.validated_data.get("mpesa_phone") or order.phone,
            )
        except CheckoutError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": f"Payment initiation failed: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "payment": payment,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    lookup_field = "number"
    ordering_fields = ["created_at", "total", "status", "paid_at"]
    ordering = ["-created_at"]
    filterset_fields = ["status", "tracking_number"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "update_status"]:
            return [IsStaff()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Order.objects.select_related("user").prefetch_related(
            "items",
            "items__product",
            "items__product__brand",
            "items__product__category",
            "status_history",
            "payments",
        )
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = ManualOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data.pop("items")
        user = serializer.validated_data.pop("user")
        try:
            order = create_manual_order(
                actor=request.user,
                user=user,
                items_data=items,
                order_data=serializer.validated_data,
            )
        except CheckoutError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def track(self, request, number=None):
        order = self.get_object()
        return Response(
            {
                "number": order.number,
                "status": order.status,
                "courier_name": order.courier_name,
                "tracking_number": order.tracking_number,
                "tracking_url": order.tracking_url,
                "history": OrderSerializer(order, context={"request": request}).data["status_history"],
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def cancel(self, request, number=None):
        order = self.get_object()
        if order.status not in {Order.Status.PENDING_PAYMENT, Order.Status.PAID}:
            return Response({"detail": "This order can no longer be cancelled by the customer."}, status=400)
        transition_order(order, Order.Status.CANCELLED, actor=request.user, note="Cancelled by customer.")
        order.refresh_from_db()
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def update_status(self, request, number=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            for field in ["courier_name", "tracking_number", "tracking_url"]:
                if field in serializer.validated_data:
                    setattr(order, field, serializer.validated_data[field])
            order.save(update_fields=["courier_name", "tracking_number", "tracking_url", "updated_at"])
            transition_order(
                order,
                serializer.validated_data["status"],
                actor=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        order.refresh_from_db()
        return Response(OrderSerializer(order, context={"request": request}).data)
