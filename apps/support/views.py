from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsStaff
from apps.support.models import SupportMessage, SupportTicket
from apps.support.serializers import SupportReplySerializer, SupportTicketSerializer


class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    ordering_fields = ["last_message_at", "created_at", "priority", "status"]
    ordering = ["-last_message_at"]
    filterset_fields = ["status", "priority", "category", "assigned_to"]

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        if self.action in ["assign", "resolve", "close"]:
            return [IsStaff()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = SupportTicket.objects.select_related("user", "order", "assigned_to").prefetch_related("messages")
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        if not request.user.is_staff and ticket.user_id != request.user.id:
            return Response({"detail": "You cannot reply to this ticket."}, status=status.HTTP_403_FORBIDDEN)
        serializer = SupportReplySerializer(data=request.data, context={"request": request, "ticket": ticket})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        ticket.refresh_from_db()
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        ticket.assigned_to = request.user
        ticket.save(update_fields=["assigned_to", "updated_at"])
        SupportMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_type=SupportMessage.SenderType.SYSTEM,
            body=f"Ticket assigned to {request.user.display_name}.",
            is_internal_note=True,
        )
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = SupportTicket.Status.RESOLVED
        ticket.save(update_fields=["status", "updated_at"])
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStaff])
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = SupportTicket.Status.CLOSED
        ticket.save(update_fields=["status", "updated_at"])
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)
