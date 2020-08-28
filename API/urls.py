from django.urls import path
from . import views

app_name = "api"
urlpatterns = [
    path("saved_states", views.saved_states, name="saved-states"),
    path("saved_projects", views.saved_projects, name="saved-projects"),
    path("new_project", views.new_project, name="new-project") # TODO: Combine into saved_projects api endpoint
]
