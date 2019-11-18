from django.urls import path
from . import views

namespace = "api"
urlpatterns = [
    path("saved_states", views.saved_states, name="saved-states")
]
