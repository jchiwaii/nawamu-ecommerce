from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from apps.accounts.views import AddressViewSet, AdminUserViewSet, MeAPIView, RegisterAPIView
from apps.cart.views import CartViewSet
from apps.catalog.views import (
    BrandViewSet,
    CategoryViewSet,
    FavoriteViewSet,
    ProductViewSet,
    ReviewViewSet,
)
from apps.common.views import NotificationViewSet
from apps.dashboard.views import AdminDashboardAPIView
from apps.orders.views import CheckoutAPIView, OrderViewSet
from apps.payments.views import MpesaCallbackAPIView, PaymentViewSet
from apps.support.views import SupportTicketViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")
router.register("products", ProductViewSet, basename="product")
router.register("favorites", FavoriteViewSet, basename="favorite")
router.register("reviews", ReviewViewSet, basename="review")
router.register("cart", CartViewSet, basename="cart")
router.register("orders", OrderViewSet, basename="order")
router.register("payments", PaymentViewSet, basename="payment")
router.register("support/tickets", SupportTicketViewSet, basename="support-ticket")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("admin/users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/register/", RegisterAPIView.as_view(), name="register"),
    path("api/auth/me/", MeAPIView.as_view(), name="me"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/addresses/", AddressViewSet.as_view({"get": "list", "post": "create"}), name="addresses"),
    path("api/addresses/<int:pk>/", AddressViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="address-detail"),
    path("api/checkout/", CheckoutAPIView.as_view(), name="checkout"),
    path("api/admin/dashboard/", AdminDashboardAPIView.as_view(), name="admin-dashboard"),
    path("api/payments/mpesa/callback/", MpesaCallbackAPIView.as_view(), name="mpesa-callback"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
