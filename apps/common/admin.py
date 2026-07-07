from django.contrib import admin

from apps.common.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "notification_type", "title", "read_at", "created_at"]
    list_filter = ["notification_type", "read_at", "created_at"]
    search_fields = ["user__email", "title", "body"]
    readonly_fields = ["created_at", "updated_at"]
