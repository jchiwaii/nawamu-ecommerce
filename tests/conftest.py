import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, ProductVariant


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        email="customer@example.com",
        password="testpass123",
        full_name="Customer One",
        phone="0712345678",
    )


@pytest.fixture
def staff_user(db):
    return get_user_model().objects.create_user(
        email="admin@example.com",
        password="testpass123",
        full_name="Admin One",
        role=get_user_model().Role.ADMIN,
        is_staff=True,
    )


@pytest.fixture
def product_variant(db):
    category = Category.objects.create(name="Running Shoes")
    brand = Brand.objects.create(name="Stride")
    product = Product.objects.create(
        name="Stride Runner Men",
        description="Best shoes for men who need everyday running comfort.",
        category=category,
        brand=brand,
        gender=Product.Gender.MEN,
        style="running",
        base_price="2500.00",
        is_featured=True,
    )
    return ProductVariant.objects.create(
        product=product,
        sku="STR-RUN-M-42-BLK",
        size="42",
        color="Black",
        stock_quantity=5,
    )
