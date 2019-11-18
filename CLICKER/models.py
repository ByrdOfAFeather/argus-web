from django.contrib.auth.models import User
from django.db import models


class SavedState(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    json = models.TextField()
    autosaved = models.BooleanField()
