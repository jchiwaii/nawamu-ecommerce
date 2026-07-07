from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Payment
from apps.payments.serializers import PaymentSerializer, RetryMpesaPaymentSerializer
from apps.payments.services import handle_mpesa_callback, initiate_mpesa_payment
from apps.orders.models import Order


class MpesaCallbackAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        payment = handle_mpesa_callback(request.data)
        return Response({"ok": True, "payment_id": payment.id if payment else None})


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering = ["-created_at"]
    filterset_fields = ["status", "provider", "order"]

    def get_queryset(self):
        queryset = Payment.objects.select_related("order", "order__user")
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(order__user=self.request.user)

    @action(detail=True, methods=["post"])
    def retry_mpesa(self, request, pk=None):
        payment = self.get_object()
        if payment.order.status != Order.Status.PENDING_PAYMENT:
            return Response({"detail": "Only pending-payment orders can be retried."}, status=400)
        if payment.status not in {Payment.Status.FAILED, Payment.Status.CANCELLED, Payment.Status.PENDING}:
            return Response({"detail": "Only failed, cancelled, or pending payments can be retried."}, status=400)
        serializer = RetryMpesaPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            response = initiate_mpesa_payment(
                order=payment.order,
                phone=serializer.validated_data.get("phone") or payment.phone or payment.order.phone,
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(response, status=status.HTTP_201_CREATED)
