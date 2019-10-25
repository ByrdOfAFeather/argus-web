from django.urls import path

from . import views

urlpatterns = [
    path('', views.clicker_index, name="clicker-index"),
    path('popped_window', views.pop_out_window, name="popped-window")
]
