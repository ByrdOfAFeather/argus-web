from django.urls import path
from . import views

app_name = "api"
urlpatterns = [
    path("saved_states", views.saved_states, name="saved-states")
]
