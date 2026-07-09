from django.db import IntegrityError
from rest_framework import serializers

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


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent", "description", "is_active", "sort_order"]
        read_only_fields = ["slug"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "description", "is_active"]
        read_only_fields = ["slug"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "alt_text", "sort_order", "is_primary"]


class ProductVariantSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "product",
            "product_name",
            "sku",
            "size",
            "color",
            "price_override",
            "price",
            "stock_quantity",
            "low_stock_threshold",
            "is_active",
            "is_low_stock",
        ]


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()
    available_sizes = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "category",
            "brand",
            "gender",
            "style",
            "base_price",
            "compare_at_price",
            "min_price",
            "primary_image",
            "available_sizes",
            "rating_avg",
            "review_count",
            "sold_count",
            "is_featured",
        ]

    def get_primary_image(self, obj):
        image = obj.images.filter(is_primary=True).first() or obj.images.first()
        return ProductImageSerializer(image, context=self.context).data if image else None

    def get_min_price(self, obj):
        prices = [variant.price for variant in obj.variants.filter(is_active=True)]
        return min(prices) if prices else obj.base_price

    def get_available_sizes(self, obj):
        return list(
            obj.variants.filter(is_active=True, stock_quantity__gt=0)
            .values_list("size", flat=True)
            .distinct()
        )


class ProductDetailSerializer(ProductListSerializer):
    description = serializers.CharField()
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "description",
            "images",
            "variants",
            "tags",
            "view_count",
            "is_active",
            "is_favorite",
            "created_at",
            "updated_at",
        ]

    def get_is_favorite(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Favorite.objects.filter(user=request.user, product=obj).exists()


class ProductWriteSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        source="tags",
        many=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "brand",
            "tag_ids",
            "gender",
            "style",
            "base_price",
            "compare_at_price",
            "is_active",
            "is_featured",
        ]
        read_only_fields = ["slug"]


class FavoriteSerializer(serializers.ModelSerializer):
    product_detail = ProductListSerializer(source="product", read_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "product", "product_detail", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({"product": "Product is already in favorites."}) from exc


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "user_name",
            "rating",
            "title",
            "comment",
            "status",
            "is_verified_purchase",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user_name", "status", "is_verified_purchase", "created_at", "updated_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        product = attrs.get("product") or getattr(self.instance, "product", None)
        if not user.is_authenticated:
            raise serializers.ValidationError("Authentication is required to review products.")
        if self.instance is None and Review.objects.filter(user=user, product=product).exists():
            raise serializers.ValidationError("You have already reviewed this product.")
        return attrs

    def create(self, validated_data):
        from apps.orders.models import OrderItem

        user = self.context["request"].user
        product = validated_data["product"]
        order_item = (
            OrderItem.objects.filter(order__user=user, product=product, order__status="delivered")
            .order_by("-created_at")
            .first()
        )
        validated_data["user"] = user
        validated_data["order_item"] = order_item
        validated_data["is_verified_purchase"] = bool(order_item)
        return super().create(validated_data)


class AdminReviewSerializer(ReviewSerializer):
    class Meta(ReviewSerializer.Meta):
        read_only_fields = ["id", "user_name", "is_verified_purchase", "created_at", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source="variant.sku", read_only=True)

    class Meta:
        model = StockMovement
        fields = ["id", "variant", "variant_sku", "movement_type", "quantity", "reason", "order", "created_by", "created_at"]
        read_only_fields = ["id", "created_at", "created_by"]
