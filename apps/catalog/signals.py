from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.catalog.models import Review


@receiver(post_save, sender=Review)
def refresh_rating_after_review_save(sender, instance: Review, **kwargs):
    instance.product.refresh_rating()


@receiver(post_delete, sender=Review)
def refresh_rating_after_review_delete(sender, instance: Review, **kwargs):
    instance.product.refresh_rating()
