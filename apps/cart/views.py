from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.cart.models import CartItem
from apps.cart.serializers import AddCartItemSerializer, CartSerializer, UpdateCartItemSerializer
from apps.cart.services import add_item, get_cart_for_request, merge_carts, update_item_quantity


class CartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        cart = get_cart_for_request(request)
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def current(self, request):
        cart = get_cart_for_request(request)
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["post"])
    def add_item(self, request):
        cart = get_cart_for_request(request)
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            add_item(cart, serializer.validated_data["variant"], serializer.validated_data["quantity"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartSerializer(cart, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["patch"])
    def update_item(self, request):
        cart = get_cart_for_request(request)
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            item = CartItem.objects.get(pk=serializer.validated_data["item_id"], cart=cart)
        except CartItem.DoesNotExist:
            return Response({"detail": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            update_item_quantity(item, serializer.validated_data["quantity"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["delete"])
    def remove_item(self, request):
        cart = get_cart_for_request(request)
        item_id = request.data.get("item_id") or request.query_params.get("item_id")
        deleted, _ = CartItem.objects.filter(pk=item_id, cart=cart).delete()
        if not deleted:
            return Response({"detail": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["delete"])
    def clear(self, request):
        cart = get_cart_for_request(request)
        cart.items.all().delete()
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def merge(self, request):
        cart = get_cart_for_request(request)
        token = request.data.get("cart_token")
        if token:
            source = get_cart_for_request(request)
            if source.pk != cart.pk:
                merge_carts(source, cart)
        return Response(CartSerializer(cart, context={"request": request}).data)
