from django.contrib import admin

from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.orders.services import transition_order


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = [
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
    can_delete = False


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ["status", "note", "actor", "created_at"]
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["number", "user", "status", "total", "courier_name", "tracking_number", "created_at"]
    list_filter = ["status", "created_at", "paid_at", "delivered_at"]
    search_fields = ["number", "user__email", "phone", "shipping_full_name", "tracking_number"]
    readonly_fields = [
        "number",
        "subtotal",
        "total",
        "paid_at",
        "cancelled_at",
        "delivered_at",
        "stock_released_at",
        "created_at",
        "updated_at",
    ]
    inlines = [OrderItemInline, OrderStatusHistoryInline]
    actions = ["mark_processing", "mark_packed", "mark_shipped", "mark_delivered", "mark_cancelled"]

    @admin.action(description="Mark selected orders processing")
    def mark_processing(self, request, queryset):
        for order in queryset:
            transition_order(order, Order.Status.PROCESSING, actor=request.user, note="Bulk admin update.")

    @admin.action(description="Mark selected orders packed")
    def mark_packed(self, request, queryset):
        for order in queryset:
            transition_order(order, Order.Status.PACKED, actor=request.user, note="Bulk admin update.")

    @admin.action(description="Mark selected orders shipped")
    def mark_shipped(self, request, queryset):
        for order in queryset:
            transition_order(order, Order.Status.SHIPPED, actor=request.user, note="Bulk admin update.")

    @admin.action(description="Mark selected orders delivered")
    def mark_delivered(self, request, queryset):
        for order in queryset:
            transition_order(order, Order.Status.DELIVERED, actor=request.user, note="Bulk admin update.")

    @admin.action(description="Cancel selected orders")
    def mark_cancelled(self, request, queryset):
        for order in queryset:
            transition_order(order, Order.Status.CANCELLED, actor=request.user, note="Bulk admin cancellation.")


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ["order", "product_name", "variant_sku", "quantity", "unit_price", "line_total"]
    search_fields = ["order__number", "product_name", "variant_sku"]
    list_select_related = ["order", "product", "variant"]


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["order", "status", "actor", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["order__number", "actor__email", "note"]
    readonly_fields = ["created_at", "updated_at"]
