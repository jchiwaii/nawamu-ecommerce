from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import generics, permissions, viewsets

from apps.accounts.models import Address
from apps.accounts.serializers import (
    AddressSerializer,
    AdminUserSerializer,
    MeSerializer,
    RegisterSerializer,
)
from apps.common.permissions import IsStaff

User = get_user_model()


class RegisterAPIView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsStaff]
    search_fields = ["email", "full_name", "phone"]
    ordering_fields = ["date_joined", "last_login", "email"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return User.objects.annotate(order_count=Count("orders"))
