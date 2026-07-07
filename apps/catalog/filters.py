import django_filters

from apps.catalog.models import Product


class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="base_price", lookup_expr="lte")
    category = django_filters.CharFilter(field_name="category__slug")
    brand = django_filters.CharFilter(field_name="brand__slug")
    tag = django_filters.CharFilter(field_name="tags__slug")
    size = django_filters.CharFilter(field_name="variants__size")
    color = django_filters.CharFilter(field_name="variants__color")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")

    class Meta:
        model = Product
        fields = ["category", "brand", "gender", "style", "is_featured", "min_price", "max_price"]

    def filter_in_stock(self, queryset, name, value):
        if value is True:
            return queryset.filter(variants__is_active=True, variants__stock_quantity__gt=0).distinct()
        if value is False:
            return queryset.exclude(variants__is_active=True, variants__stock_quantity__gt=0).distinct()
        return queryset
