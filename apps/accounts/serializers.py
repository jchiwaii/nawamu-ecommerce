from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Address, CustomerProfile

User = get_user_model()


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "date_joined"]
        read_only_fields = ["id", "role", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "password"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ["marketing_opt_in", "notes", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class MeSerializer(serializers.ModelSerializer):
    customer_profile = CustomerProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "role",
            "is_staff",
            "email_verified",
            "customer_profile",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "role", "is_staff", "email_verified", "date_joined"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("customer_profile", None)
        instance = super().update(instance, validated_data)
        if profile_data is not None and hasattr(instance, "customer_profile"):
            for key, value in profile_data.items():
                setattr(instance.customer_profile, key, value)
            instance.customer_profile.save()
        return instance


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id",
            "address_type",
            "full_name",
            "phone",
            "line1",
            "line2",
            "city",
            "county",
            "country",
            "postal_code",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    order_count = serializers.IntegerField(read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "full_name",
            "phone",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "email_verified",
            "order_count",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "order_count"]

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Password is required when creating a user."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "")
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["password"])
        return instance
