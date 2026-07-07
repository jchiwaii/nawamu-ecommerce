from django.contrib import admin
from django.db.models import F

from apps.catalog.models import (
    Brand,
    Category,
    Favorite,
    Product,
    ProductImage,
    ProductVariant,
    Review,
    StockMovement,
    Tag,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1
    fields = ["sku", "size", "color", "price_override", "stock_quantity", "low_stock_threshold", "is_active"]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "is_active", "sort_order"]
    list_filter = ["is_active", "parent"]
    search_fields = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "brand", "category", "gender", "base_price", "rating_avg", "sold_count", "is_featured", "is_active"]
    list_filter = ["is_active", "is_featured", "gender", "brand", "category"]
    search_fields = ["name", "description", "style", "brand__name", "category__name", "tags__name"]
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ["tags"]
    readonly_fields = ["rating_avg", "review_count", "sold_count", "view_count", "created_at", "updated_at"]
    inlines = [ProductImageInline, ProductVariantInline]
    actions = ["mark_active", "mark_inactive", "mark_featured", "clear_featured"]

    @admin.action(description="Mark selected products active")
    def mark_active(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Mark selected products inactive")
    def mark_inactive(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="Feature selected products")
    def mark_featured(self, request, queryset):
        queryset.update(is_featured=True)

    @admin.action(description="Remove featured flag")
    def clear_featured(self, request, queryset):
        queryset.update(is_featured=False)


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ["sku", "product", "size", "color", "price", "stock_quantity", "low_stock_threshold", "is_low_stock", "is_active"]
    list_filter = ["is_active", "size", "color", "product__brand"]
    search_fields = ["sku", "product__name", "color", "size"]
    list_select_related = ["product", "product__brand"]
    actions = ["mark_active", "mark_inactive"]

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.GET.get("low_stock") == "1":
            queryset = queryset.filter(stock_quantity__lte=F("low_stock_threshold"))
        return queryset

    @admin.action(description="Mark variants active")
    def mark_active(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Mark variants inactive")
    def mark_inactive(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["variant", "movement_type", "quantity", "order", "created_by", "created_at"]
    list_filter = ["movement_type", "created_at"]
    search_fields = ["variant__sku", "variant__product__name", "order__number"]
    readonly_fields = ["created_at", "updated_at"]
    list_select_related = ["variant", "variant__product", "order", "created_by"]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["product", "user", "rating", "status", "is_verified_purchase", "created_at"]
    list_filter = ["status", "rating", "is_verified_purchase", "created_at"]
    search_fields = ["product__name", "user__email", "title", "comment"]
    readonly_fields = ["is_verified_purchase", "created_at", "updated_at"]
    actions = ["approve_reviews", "reject_reviews"]

    @admin.action(description="Approve selected reviews")
    def approve_reviews(self, request, queryset):
        queryset.update(status=Review.Status.APPROVED)
        for review in queryset.select_related("product"):
            review.product.refresh_rating()

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        queryset.update(status=Review.Status.REJECTED)
        for review in queryset.select_related("product"):
            review.product.refresh_rating()


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ["user", "product", "created_at"]
    search_fields = ["user__email", "product__name"]
    list_select_related = ["user", "product"]
