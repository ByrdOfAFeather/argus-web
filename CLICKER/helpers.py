import json

from django.core.exceptions import ObjectDoesNotExist

from CLICKER.models import SavedState, ProjectToMostRecentState


def create_saved_state_and_project_link(user, data, auto_save, project, date_created):
	new_state = SavedState.objects.create(
		user=user,
		json=json.dumps(data),
		autosaved=auto_save,
		date_created=date_created,
		project=project
	)
	new_state.save()

	try:
		most_recent_state = ProjectToMostRecentState.objects.get(project=project)
		if most_recent_state.saved_state.date_created < new_state.date_created:
			most_recent_state.saved_state = new_state
			most_recent_state.save()
	except ObjectDoesNotExist:
		recent_state = ProjectToMostRecentState.objects.create(
			project=project,
			saved_state=new_state
		)
		recent_state.save()
