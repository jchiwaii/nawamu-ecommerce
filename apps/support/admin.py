from django.contrib import admin

from apps.support.models import SupportMessage, SupportTicket


class SupportMessageInline(admin.TabularInline):
    model = SupportMessage
    extra = 1
    fields = ["sender", "sender_type", "body", "is_internal_note", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ["subject", "email", "status", "priority", "assigned_to", "last_message_at", "created_at"]
    list_filter = ["status", "priority", "category", "assigned_to", "created_at"]
    search_fields = ["subject", "email", "phone", "messages__body", "order__number"]
    readonly_fields = ["last_message_at", "created_at", "updated_at"]
    inlines = [SupportMessageInline]
    actions = ["mark_resolved", "mark_closed"]

    @admin.action(description="Mark selected tickets resolved")
    def mark_resolved(self, request, queryset):
        queryset.update(status=SupportTicket.Status.RESOLVED)

    @admin.action(description="Mark selected tickets closed")
    def mark_closed(self, request, queryset):
        queryset.update(status=SupportTicket.Status.CLOSED)


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ["ticket", "sender", "sender_type", "is_internal_note", "created_at"]
    list_filter = ["sender_type", "is_internal_note", "created_at"]
    search_fields = ["ticket__subject", "sender__email", "body"]
    readonly_fields = ["created_at", "updated_at"]
