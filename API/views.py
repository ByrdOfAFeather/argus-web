import json

from django.http import JsonResponse
from django.utils.timezone import now
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from CLICKER.helpers import create_saved_state_and_project_link
from CLICKER.models import SavedState, Project


# TODO SERIALIZATION

@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def saved_states(request):
    if request.method == "GET":
        """
		Returns the 5 most recently added objects to the database that match the user making the query starting from
		pagination provided
		"""
        start_index = 0
        try:
            start_index = int(request.GET.get('pagination', 0))
        except ValueError:
            print("Non integer value sent for pagination, defaulting to 0")
        project_id = request.GET.get("projectID", False)
        if not project_id:
            # TODO: Error here
            pass

        project_object = Project.objects.get(id=project_id)
        user_states = SavedState.objects.filter(
            user=request.user,
            project=project_object).order_by("-id")

        json_objects = []
        for state in user_states:
            json_objects.append(
                {
                    "state_data": json.loads(state.json),
                    "project_id": state.project.id,
                    "state_id": state.id
                }
            )

        response = JsonResponse({"states": json_objects})
        response.status_code = 200
        return response

    elif request.method == "POST":
        """
		Adds a new savedstate to the database either overriding a previous autosave or making a new object
		"""
        data = request.POST.get("json", "")
        auto_save = request.POST.get("autosave", "")
        project_id = request.POST.get("projectID", "")

        # TODO: Find if the user is associated with the project
        try:
            project = Project.objects.get(owner=request.user, id=project_id)
        except Project.DoesNotExist:
            response = JsonResponse({"error": "There is no project with that ID!"})
            response.status_code = 404
            return response

        auto_save = True if len(auto_save) > 0 else False

        date_created = now()

        # TODO: SERIALIZATION
        if auto_save:
            try:
                auto_saved_for_this_state = SavedState.objects.get(user=request.user, autosaved=auto_save)
                auto_saved_for_this_state.json = json.dumps(data)
                auto_saved_for_this_state.save()
            except SavedState.DoesNotExist:
                create_saved_state_and_project_link(request.user, data, auto_save, project, date_created)
        else:
            create_saved_state_and_project_link(request.user, data, auto_save, project, date_created)
        response = JsonResponse({"success": "none"})
        response.status_code = 200
        return response

    elif request.method == "DELETE":
        """
        Deletes a saved state if the user is the creator of the saved state
		"""
        state_id = request.POST.get("id", "")
        print(state_id)
        try:
            saved_state = SavedState.objects.get(user=request.user, id=state_id)
            saved_state.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except SavedState.DoesNotExist:
            response = JsonResponse({"error": "Saved State does not exist with that id!"})
            response.status_code = 404
            return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def saved_projects(request):
    if request.method == "GET":
        projects = Project.objects.filter(owner=request.user)
        return_json = {
            "projects": [(project.name, project.description, project.id) for project in projects]
        }
        response = JsonResponse(return_json)
        response.status_code = 200
        return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def new_project(request):
    # files = request.FILES.getlist('files')
    # TODO: The server will just have a 500 moment if something in the form is not there
    # TODO: Security concerns & Re-enable this feature
    # https://docs.djangoproject.com/en/2.2/topics/security/#user-uploaded-content-security
    # public = True if request.data["public"] == "true" else False
    project = Project(name=request.data["title"], description=request.data["description"], owner=request.user,
                      public=False)
    project.save()
    # for file in files:
    #     instance = Videos(video=file)
    #     instance.save()
    #     ProjectToVideos(project=project, video=instance).save()
    response = JsonResponse({"success": {"data": {"id": f"{project.id}"}}})
    response.status_code = 200
    return response
