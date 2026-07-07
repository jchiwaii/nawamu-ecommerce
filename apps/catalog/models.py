from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import connection, models
from django.db.models import Avg, Count, Q
from django.utils.text import slugify

from apps.common.models import TimeStampedModel
from apps.common.utils import money


class Category(TimeStampedModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Category, self.name)
        super().save(*args, **kwargs)


class Brand(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Brand, self.name)
        super().save(*args, **kwargs)


class Tag(TimeStampedModel):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Tag, self.name)
        super().save(*args, **kwargs)


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True, category__is_active=True, brand__is_active=True)

    def search(self, query: str):
        query = (query or "").strip()
        if not query:
            return self

        normalized = query.lower()
        gender_filter = Q()
        if any(token in normalized for token in ["men", "mens", "male", "man"]):
            gender_filter |= Q(gender__in=[Product.Gender.MEN, Product.Gender.UNISEX])
        if any(token in normalized for token in ["women", "womens", "female", "lady", "ladies"]):
            gender_filter |= Q(gender__in=[Product.Gender.WOMEN, Product.Gender.UNISEX])
        if any(token in normalized for token in ["kids", "children", "child"]):
            gender_filter |= Q(gender=Product.Gender.KIDS)

        queryset = self
        if gender_filter:
            queryset = queryset.filter(gender_filter)

        if connection.vendor == "postgresql":
            from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector, TrigramSimilarity

            vector = (
                SearchVector("name", weight="A")
                + SearchVector("description", weight="B")
                + SearchVector("style", weight="B")
                + SearchVector("category__name", weight="B")
                + SearchVector("brand__name", weight="B")
                + SearchVector("tags__name", weight="C")
            )
            search_query = SearchQuery(query, search_type="websearch")
            queryset = queryset.annotate(
                search_rank=SearchRank(vector, search_query),
                similarity=TrigramSimilarity("name", query)
                + TrigramSimilarity("description", query)
                + TrigramSimilarity("brand__name", query)
                + TrigramSimilarity("category__name", query),
            ).filter(Q(search_rank__gte=0.05) | Q(similarity__gte=0.08))
            ordering = ["-search_rank", "-similarity", "-rating_avg", "-sold_count", "-view_count"]
            return queryset.distinct().order_by(*ordering)

        fallback_filter = (
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(style__icontains=query)
            | Q(category__name__icontains=query)
            | Q(brand__name__icontains=query)
            | Q(tags__name__icontains=query)
        )
        words = [word for word in normalized.replace("-", " ").split() if len(word) > 2]
        for word in words:
            fallback_filter |= Q(name__icontains=word) | Q(description__icontains=word) | Q(tags__name__icontains=word)
        return queryset.filter(fallback_filter).distinct().order_by("-rating_avg", "-sold_count", "-view_count")


class Product(TimeStampedModel):
    class Gender(models.TextChoices):
        MEN = "men", "Men"
        WOMEN = "women", "Women"
        UNISEX = "unisex", "Unisex"
        KIDS = "kids", "Kids"

    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField()
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    tags = models.ManyToManyField(Tag, blank=True, related_name="products")
    gender = models.CharField(max_length=16, choices=Gender.choices, default=Gender.UNISEX, db_index=True)
    style = models.CharField(max_length=120, blank=True, db_index=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.00"))
    review_count = models.PositiveIntegerField(default=0)
    sold_count = models.PositiveIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-is_featured", "name"]
        indexes = [
            models.Index(fields=["is_active", "gender"]),
            models.Index(fields=["is_featured", "sold_count"]),
            models.Index(fields=["rating_avg", "sold_count"]),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Product, self.name)
        self.base_price = money(self.base_price)
        if self.compare_at_price is not None:
            self.compare_at_price = money(self.compare_at_price)
        super().save(*args, **kwargs)

    def refresh_rating(self) -> None:
        approved = self.reviews.filter(status=Review.Status.APPROVED)
        aggregate = approved.aggregate(avg=Avg("rating"), count=Count("id"))
        self.rating_avg = money(aggregate["avg"] or 0)
        self.review_count = aggregate["count"] or 0
        self.save(update_fields=["rating_avg", "review_count", "updated_at"])


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/")
    alt_text = models.CharField(max_length=160, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.alt_text or self.product.name


class ProductVariant(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=80, unique=True)
    size = models.CharField(max_length=32, db_index=True)
    color = models.CharField(max_length=80, db_index=True)
    price_override = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["product__name", "size", "color"]
        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["sku"]),
            models.Index(fields=["stock_quantity"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["product", "size", "color"], name="unique_product_size_color")
        ]

    def __str__(self) -> str:
        return f"{self.product.name} - {self.size} / {self.color}"

    @property
    def price(self):
        return money(self.price_override if self.price_override is not None else self.product.base_price)

    @property
    def is_low_stock(self) -> bool:
        return self.stock_quantity <= self.low_stock_threshold


class StockMovement(TimeStampedModel):
    class MovementType(models.TextChoices):
        INITIAL = "initial", "Initial"
        RESTOCK = "restock", "Restock"
        SALE = "sale", "Sale"
        RELEASE = "release", "Release"
        ADJUSTMENT = "adjustment", "Adjustment"
        RETURN = "return", "Return"

    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="stock_movements")
    movement_type = models.CharField(max_length=24, choices=MovementType.choices)
    quantity = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True)
    order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_movements")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.variant.sku}: {self.quantity}"


class Favorite(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="favorited_by")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="unique_user_favorite_product")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} likes {self.product.name}"


class Review(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    order_item = models.ForeignKey("orders.OrderItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=160, blank=True)
    comment = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    is_verified_purchase = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="unique_user_product_review")]

    def __str__(self) -> str:
        return f"{self.product.name} review by {self.user.email}"


def unique_slug(model: type[models.Model], value: str) -> str:
    base = slugify(value)[:180] or "item"
    slug = base
    counter = 2
    while model.objects.filter(slug=slug).exists():
        suffix = f"-{counter}"
        slug = f"{base[: 220 - len(suffix)]}{suffix}"
        counter += 1
    return slug
