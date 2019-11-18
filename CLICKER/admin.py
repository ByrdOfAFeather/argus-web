from django.contrib import admin
from CLICKER.models import SavedState


@admin.register(SavedState)
class SavedStateAdmin(admin.ModelAdmin):
    model = SavedState
