from django.db.models import F, Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalog.filters import ProductFilter
from apps.catalog.models import Brand, Category, Favorite, Product, ProductVariant, Review
from apps.catalog.serializers import (
    AdminReviewSerializer,
    BrandSerializer,
    CategorySerializer,
    FavoriteSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductWriteSerializer,
    ProductVariantSerializer,
    ReviewSerializer,
)
from apps.common.permissions import IsAdminOrReadOnly, IsStaff


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    search_fields = ["name", "description"]

    def get_queryset(self):
        queryset = Category.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class BrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    search_fields = ["name", "description"]

    def get_queryset(self):
        queryset = Brand.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter
    ordering_fields = ["base_price", "rating_avg", "sold_count", "created_at"]
    ordering = ["-is_featured", "-sold_count", "name"]

    def get_queryset(self):
        variant_queryset = ProductVariant.objects.all() if self.request.user.is_staff else ProductVariant.objects.filter(is_active=True)
        queryset = (
            Product.objects.select_related("category", "brand")
            .prefetch_related("tags", "images", Prefetch("variants", queryset=variant_queryset))
        )
        if not self.request.user.is_staff:
            queryset = queryset.active()
        search_query = self.request.query_params.get("q") or self.request.query_params.get("search")
        if search_query:
            queryset = queryset.search(search_query)
        return queryset.distinct()

    def get_serializer_class(self):
        if self.request.method not in permissions.SAFE_METHODS:
            return ProductWriteSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Product.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def favorite(self, request, slug=None):
        product = self.get_object()
        favorite, created = Favorite.objects.get_or_create(user=request.user, product=product)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(FavoriteSerializer(favorite, context={"request": request}).data, status=status_code)

    @favorite.mapping.delete
    def unfavorite(self, request, slug=None):
        product = self.get_object()
        Favorite.objects.filter(user=request.user, product=product).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def reviews(self, request, slug=None):
        product = self.get_object()
        queryset = product.reviews.filter(status=Review.Status.APPROVED).select_related("user")
        page = self.paginate_queryset(queryset)
        serializer = ReviewSerializer(page or queryset, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("product", "product__category", "product__brand")


class ProductVariantViewSet(viewsets.ModelViewSet):
    serializer_class = ProductVariantSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["product", "sku", "size", "color", "is_active"]
    search_fields = ["sku", "product__name", "size", "color"]
    ordering_fields = ["stock_quantity", "sku", "created_at"]
    ordering = ["product__name", "size", "color"]

    def get_queryset(self):
        return ProductVariant.objects.select_related("product", "product__brand", "product__category")


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ["product", "status", "rating", "is_verified_purchase"]
    ordering_fields = ["created_at", "rating"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "product")
        if self.request.user.is_staff:
            return queryset
        if self.request.user.is_authenticated and self.request.query_params.get("mine") == "true":
            return queryset.filter(user=self.request.user)
        return queryset.filter(status=Review.Status.APPROVED)

    def get_serializer_class(self):
        if self.request.user.is_staff:
            return AdminReviewSerializer
        return ReviewSerializer

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def approve(self, request, pk=None):
        review = self.get_object()
        review.status = Review.Status.APPROVED
        review.save(update_fields=["status", "updated_at"])
        return Response(AdminReviewSerializer(review, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def reject(self, request, pk=None):
        review = self.get_object()
        review.status = Review.Status.REJECTED
        review.save(update_fields=["status", "updated_at"])
        return Response(AdminReviewSerializer(review, context={"request": request}).data)
