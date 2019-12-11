from django.contrib import admin
from CLICKER.models import SavedState, Videos, Project, ProjectToVideos


@admin.register(SavedState)
class SavedStateAdmin(admin.ModelAdmin):
    model = SavedState


@admin.register(Videos)
class VideosAdmin(admin.ModelAdmin):
    model = Videos


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    model = Project


@admin.register(ProjectToVideos)
class ProjectToVideosAdmin(admin.ModelAdmin):
    model = ProjectToVideos
