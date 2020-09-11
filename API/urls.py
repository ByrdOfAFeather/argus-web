from django.urls import path
from . import views

app_name = "api"
urlpatterns = [
    path("saved_states", views.saved_states, name="saved-states"),
    path("saved_projects", views.saved_projects, name="saved-projects"),
]
