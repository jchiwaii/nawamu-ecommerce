from rest_framework import serializers

from apps.common.models import Notification
from apps.support.models import SupportMessage, SupportTicket


class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ["id", "sender_type", "sender_name", "body", "is_internal_note", "created_at"]
        read_only_fields = ["id", "sender_type", "sender_name", "created_at"]


class SupportTicketSerializer(serializers.ModelSerializer):
    messages = SupportMessageSerializer(many=True, read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.display_name", read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "subject",
            "email",
            "phone",
            "category",
            "priority",
            "status",
            "order",
            "assigned_to",
            "assigned_to_name",
            "messages",
            "last_message_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "assigned_to_name", "messages", "last_message_at", "created_at", "updated_at"]
        extra_kwargs = {
            "email": {"required": False},
            "phone": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        request = self.context["request"]
        if not request.user.is_authenticated and not attrs.get("email"):
            raise serializers.ValidationError({"email": "Email is required for anonymous support requests."})
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        initial_message = request.data.get("message", "")
        if request.user.is_authenticated:
            validated_data.setdefault("user", request.user)
            validated_data.setdefault("email", request.user.email)
            validated_data.setdefault("phone", request.user.phone)
        ticket = super().create(validated_data)
        if initial_message:
            SupportMessage.objects.create(
                ticket=ticket,
                sender=request.user if request.user.is_authenticated else None,
                sender_type=SupportMessage.SenderType.CUSTOMER,
                body=initial_message,
            )
        return ticket


class SupportReplySerializer(serializers.Serializer):
    body = serializers.CharField()
    is_internal_note = serializers.BooleanField(default=False)

    def create(self, validated_data):
        request = self.context["request"]
        ticket = self.context["ticket"]
        sender_type = SupportMessage.SenderType.ADMIN if request.user.is_staff else SupportMessage.SenderType.CUSTOMER
        message = SupportMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_type=sender_type,
            body=validated_data["body"],
            is_internal_note=validated_data["is_internal_note"] if request.user.is_staff else False,
        )
        if request.user.is_staff:
            ticket.status = SupportTicket.Status.WAITING_CUSTOMER
            ticket.assigned_to = ticket.assigned_to or request.user
            ticket.save(update_fields=["status", "assigned_to", "updated_at"])
            if ticket.user and not message.is_internal_note:
                Notification.objects.create(
                    user=ticket.user,
                    notification_type=Notification.NotificationType.SUPPORT,
                    title=f"Support replied: {ticket.subject}",
                    body=message.body[:240],
                    data={"ticket_id": ticket.id},
                )
        else:
            ticket.status = SupportTicket.Status.WAITING_ADMIN
            ticket.save(update_fields=["status", "updated_at"])
        return message
