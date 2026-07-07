from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Address, CustomerProfile, User


class AddressInline(admin.TabularInline):
    model = Address
    extra = 0
    fields = ["address_type", "full_name", "phone", "city", "county", "is_default"]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ["email", "full_name", "phone", "role", "is_staff", "is_active", "date_joined"]
    list_filter = ["role", "is_staff", "is_active", "email_verified", "date_joined"]
    search_fields = ["email", "full_name", "phone"]
    ordering = ["-date_joined"]
    inlines = [AddressInline]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "phone", "role", "email_verified")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "phone", "role", "password1", "password2"),
            },
        ),
    )
    readonly_fields = ["last_login", "date_joined"]


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "marketing_opt_in", "created_at", "updated_at"]
    search_fields = ["user__email", "user__full_name"]
    list_filter = ["marketing_opt_in"]


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ["user", "address_type", "full_name", "phone", "city", "county", "is_default"]
    list_filter = ["address_type", "country", "city", "is_default"]
    search_fields = ["user__email", "full_name", "phone", "city", "county"]
