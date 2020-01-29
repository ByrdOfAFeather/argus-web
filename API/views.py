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

        saved_state_query_set = SavedState.objects.filter(
            user=request.user,
            autosaved=False).order_by("-id")

        end_of_pagination = False
        user_states = saved_state_query_set[start_index:start_index + 5]
        if not user_states:
            end_of_pagination = True
            query_set_length = len(saved_state_query_set)
            if query_set_length == 0:
                user_states = []
            else:
                user_states = saved_state_query_set[query_set_length - 6: query_set_length - 1]

        else:
            if len(user_states) < 5: end_of_pagination = True

        json_objects = []
        for state in user_states:
            json_objects.append(
                {
                    "state_data": json.loads(state.json),
                    "project_id": state.project.id,
                    "state_id": state.id
                }
            )

        try:
            user_autosaved_state = SavedState.objects.get(user=request.user, autosaved=True)
            json_objects.append(
                {
                    "state_data": json.loads(user_autosaved_state.json[0:-2] + r',\"autosaved\": true }"'),
                    "project_id": user_autosaved_state.project.id,
                    "state_id": user_autosaved_state.id
                }
            )
        except SavedState.DoesNotExist:
            pass

        response = JsonResponse({"states": json_objects, "end_of_pagination": end_of_pagination})
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


@api_view(["POST"])
def new_project(request):
    print(request.FILES)
    if "files" not in request.data or len(request.data['title']) == 0:
        response = JsonResponse({"Error": "Malformed Form Data"})
        response.status_code = 405
        return response
    else:
        # files = request.FILES.getlist('files')

        # TODO: Security concerns & Re-enable this feature
        # https://docs.djangoproject.com/en/2.2/topics/security/#user-uploaded-content-security
        request.data["public"] = True if request.data["public"] == "true" else False
        project = Project(name=request.data["title"], description=request.data["description"], owner=request.user,
                          public=request.data["public"])
        project.save()
        # for file in files:
        #     instance = Videos(video=file)
        #     instance.save()
        #     ProjectToVideos(project=project, video=instance).save()
        response = JsonResponse({"success": {"data": {"id": f"{project.id}"}}})
        response.status_code = 200
        return response
