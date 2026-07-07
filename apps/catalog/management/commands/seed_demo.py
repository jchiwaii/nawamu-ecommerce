from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.catalog.models import Brand, Category, Product, ProductImage, ProductVariant, Tag


class Command(BaseCommand):
    help = "Seed demo users and shoe catalog data."

    def handle(self, *args, **options):
        User = get_user_model()
        admin, created = User.objects.get_or_create(
            email="admin@example.com",
            defaults={
                "full_name": "Store Admin",
                "phone": "0711000000",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("AdminPass123!")
            admin.save()

        customer, created = User.objects.get_or_create(
            email="customer@example.com",
            defaults={
                "full_name": "Demo Customer",
                "phone": "0712345678",
                "role": User.Role.CUSTOMER,
            },
        )
        if created:
            customer.set_password("CustomerPass123!")
            customer.save()

        running = Category.objects.get_or_create(name="Running Shoes")[0]
        sneakers = Category.objects.get_or_create(name="Sneakers")[0]
        boots = Category.objects.get_or_create(name="Boots")[0]

        stride = Brand.objects.get_or_create(name="Stride")[0]
        urban = Brand.objects.get_or_create(name="UrbanStep")[0]
        trail = Brand.objects.get_or_create(name="TrailForge")[0]

        tags = {
            name: Tag.objects.get_or_create(name=name)[0]
            for name in ["men", "women", "running", "casual", "leather", "lightweight", "best-seller"]
        }

        products = [
            {
                "name": "Stride Runner Men",
                "description": "Best shoes for men who need everyday running comfort and breathable support.",
                "category": running,
                "brand": stride,
                "gender": Product.Gender.MEN,
                "style": "running",
                "base_price": "2500.00",
                "tags": ["men", "running", "lightweight", "best-seller"],
                "variants": [("STR-RUN-M-41-BLK", "41", "Black", 18), ("STR-RUN-M-42-BLK", "42", "Black", 24)],
            },
            {
                "name": "UrbanStep Classic Women",
                "description": "Clean everyday sneakers for women with soft cushioning and durable canvas.",
                "category": sneakers,
                "brand": urban,
                "gender": Product.Gender.WOMEN,
                "style": "casual",
                "base_price": "3200.00",
                "tags": ["women", "casual", "lightweight"],
                "variants": [("URB-CLS-W-38-WHT", "38", "White", 14), ("URB-CLS-W-39-WHT", "39", "White", 11)],
            },
            {
                "name": "TrailForge Leather Boot",
                "description": "Unisex leather boots for wet streets, light trails, and long-lasting daily wear.",
                "category": boots,
                "brand": trail,
                "gender": Product.Gender.UNISEX,
                "style": "boots",
                "base_price": "5800.00",
                "tags": ["men", "women", "leather"],
                "variants": [("TRL-LTH-U-42-BRN", "42", "Brown", 9), ("TRL-LTH-U-43-BRN", "43", "Brown", 8)],
            },
        ]

        for data in products:
            product, _ = Product.objects.update_or_create(
                name=data["name"],
                defaults={
                    "description": data["description"],
                    "category": data["category"],
                    "brand": data["brand"],
                    "gender": data["gender"],
                    "style": data["style"],
                    "base_price": data["base_price"],
                    "is_active": True,
                    "is_featured": "best-seller" in data["tags"],
                },
            )
            product.tags.set([tags[name] for name in data["tags"]])
            ProductImage.objects.get_or_create(
                product=product,
                alt_text=product.name,
                defaults={"image": "products/demo-placeholder.jpg", "is_primary": True},
            )
            for sku, size, color, stock in data["variants"]:
                ProductVariant.objects.update_or_create(
                    sku=sku,
                    defaults={
                        "product": product,
                        "size": size,
                        "color": color,
                        "stock_quantity": stock,
                        "low_stock_threshold": 5,
                        "is_active": True,
                    },
                )

        self.stdout.write(self.style.SUCCESS("Seeded demo ecommerce data."))
