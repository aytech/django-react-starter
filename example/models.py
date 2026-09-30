from django.db import models
from django.utils.translation import gettext_lazy as _


class Example(models.Model):
    name = models.CharField(
        _("Name"),
        default=_("Django + React"),
        max_length=100)
    title = models.CharField(
        _("Title"),
        default=_("This is the starter project"),
        max_length=100)

    def __str__(self):
        return self.name
