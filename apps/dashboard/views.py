from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product, ProductVariant
from apps.common.permissions import IsStaff
from apps.orders.models import Order
from apps.support.models import SupportTicket

User = get_user_model()


class AdminDashboardAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        paid_orders = Order.objects.filter(status__in=[Order.Status.PAID, Order.Status.PROCESSING, Order.Status.PACKED, Order.Status.SHIPPED, Order.Status.DELIVERED])
        low_stock = ProductVariant.objects.filter(is_active=True, stock_quantity__lte=F("low_stock_threshold")).select_related("product")
        best_sellers = Product.objects.order_by("-sold_count", "-rating_avg")[:10]
        recent_orders = Order.objects.select_related("user").order_by("-created_at")[:10]
        pending_tickets = SupportTicket.objects.filter(
            status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.WAITING_ADMIN]
        ).order_by("-last_message_at")[:10]

        return Response(
            {
                "metrics": {
                    "revenue": paid_orders.aggregate(
                        total=Coalesce(Sum("total"), Value(0), output_field=DecimalField(max_digits=12, decimal_places=2))
                    )["total"],
                    "orders_total": Order.objects.count(),
                    "orders_pending_payment": Order.objects.filter(status=Order.Status.PENDING_PAYMENT).count(),
                    "orders_to_fulfill": Order.objects.filter(status__in=[Order.Status.PAID, Order.Status.PROCESSING, Order.Status.PACKED]).count(),
                    "customers_total": User.objects.filter(is_staff=False).count(),
                    "products_active": Product.objects.filter(is_active=True).count(),
                    "low_stock_count": low_stock.count(),
                    "pending_support_count": SupportTicket.objects.filter(status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.WAITING_ADMIN]).count(),
                },
                "low_stock": [
                    {
                        "variant_id": variant.id,
                        "sku": variant.sku,
                        "product": variant.product.name,
                        "size": variant.size,
                        "color": variant.color,
                        "stock_quantity": variant.stock_quantity,
                        "threshold": variant.low_stock_threshold,
                    }
                    for variant in low_stock[:20]
                ],
                "best_sellers": [
                    {
                        "id": product.id,
                        "name": product.name,
                        "slug": product.slug,
                        "sold_count": product.sold_count,
                        "rating_avg": product.rating_avg,
                    }
                    for product in best_sellers
                ],
                "recent_orders": [
                    {
                        "id": order.id,
                        "number": order.number,
                        "customer": order.user.email,
                        "status": order.status,
                        "total": order.total,
                        "created_at": order.created_at,
                    }
                    for order in recent_orders
                ],
                "pending_tickets": [
                    {
                        "id": ticket.id,
                        "subject": ticket.subject,
                        "email": ticket.email,
                        "priority": ticket.priority,
                        "status": ticket.status,
                        "last_message_at": ticket.last_message_at,
                    }
                    for ticket in pending_tickets
                ],
                "order_status_counts": list(Order.objects.values("status").annotate(count=Count("id")).order_by("status")),
            }
        )
