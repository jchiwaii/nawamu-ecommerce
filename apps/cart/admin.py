from django.contrib import admin

from apps.cart.models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ["unit_price", "line_total", "created_at", "updated_at"]


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ["token", "user", "status", "item_count", "subtotal", "created_at", "updated_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["token", "user__email"]
    readonly_fields = ["token", "subtotal", "item_count", "created_at", "updated_at"]
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ["cart", "variant", "quantity", "unit_price", "line_total", "created_at"]
    search_fields = ["cart__token", "cart__user__email", "variant__sku", "variant__product__name"]
    list_select_related = ["cart", "cart__user", "variant", "variant__product"]
