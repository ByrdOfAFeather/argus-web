from django.contrib.auth.models import User
from django.db import models


class SavedState(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    json = models.TextField()
    autosaved = models.BooleanField()
    date_created = models.DateTimeField()


class Project(models.Model):
    name = models.CharField(max_length=250)
    description = models.TextField(null=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    public = models.BooleanField()


class Videos(models.Model):
    video = models.FileField()


class ProjectToVideos(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    # TODO: This might be a bit presumptious in delete
    video = models.ForeignKey(Videos, on_delete=models.CASCADE)


class ProjectToSavedStates(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    savedState = models.ForeignKey(SavedState, on_delete=models.CASCADE)