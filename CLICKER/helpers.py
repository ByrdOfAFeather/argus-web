import json

from CLICKER.models import SavedState


def create_saved_state_and_project_link(user, data, auto_save, project, date_created):
	new_state = SavedState.objects.create(
		user=user,
		json=json.dumps(data),
		autosaved=auto_save,
		date_created=date_created,
		project=project
	)
	new_state.save()

