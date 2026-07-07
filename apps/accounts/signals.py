from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import CustomerProfile, User


@receiver(post_save, sender=User)
def ensure_customer_profile(sender, instance: User, created: bool, **kwargs):
    if created and instance.role == User.Role.CUSTOMER:
        CustomerProfile.objects.get_or_create(user=instance)
