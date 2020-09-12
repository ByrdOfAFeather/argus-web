from django.contrib.auth.models import User
from django.db import models


class Project(models.Model):
	name = models.CharField(max_length=250)
	description = models.TextField(null=True)
	owner = models.ForeignKey(User, on_delete=models.CASCADE)
	public = models.BooleanField()

	class Meta:
		unique_together = ("owner", "name")


class SavedState(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE)
	json = models.TextField()
	autosaved = models.BooleanField()
	date_created = models.DateTimeField()
	project = models.ForeignKey(Project, on_delete=models.CASCADE)


class ProjectToMostRecentState(models.Model):
	project = models.ForeignKey(Project, null=False, on_delete=models.CASCADE)
	saved_state = models.ForeignKey(SavedState, null=True, on_delete=models.CASCADE)


class Videos(models.Model):
	video = models.FileField()


class ProjectToVideos(models.Model):
	project = models.ForeignKey(Project, on_delete=models.CASCADE)
	# TODO: This might be a bit presumptions in delete
	video = models.ForeignKey(Videos, on_delete=models.CASCADE)
