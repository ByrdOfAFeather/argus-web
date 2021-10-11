import json

from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from django.utils.timezone import now
from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from CLICKER.helpers import create_saved_state_and_project_link
from CLICKER.models import SavedState, Project, ProjectToMostRecentState


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
                    "stateData": json.loads(state.json),
                    "projectID": state.project.id,
                    "stateID": state.id
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
                auto_saved_for_this_state = SavedState.objects.get(user=request.user, autosaved=auto_save,
                                                                   project=project)
                auto_saved_for_this_state.json = json.dumps(data)
                auto_saved_for_this_state.save()

                try:
                    most_recent_state = ProjectToMostRecentState.objects.get(project=project)
                    if most_recent_state.saved_state.date_created < auto_saved_for_this_state.date_created:
                        most_recent_state.saved_state = auto_saved_for_this_state
                        most_recent_state.save()
                except ObjectDoesNotExist:
                    recent_state = ProjectToMostRecentState.objects.create(
                        project=project,
                        saved_state=auto_saved_for_this_state
                    )
                    recent_state.save()
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


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def saved_projects(request):
    if request.method == "GET":
        try:
            pagination_index = int(request.GET.get("pagination_idx", 0))
        except ValueError:
            pagination_index = 0

        projects = ProjectToMostRecentState.objects.filter(project__owner=request.user).order_by(
            "-saved_state__date_created")

        end_idx = pagination_index + 5
        paginated_projects = projects[pagination_index: end_idx]
        end_of_pagination = False
        if end_idx >= len(projects): end_of_pagination = True
        json_objects = [{
            "projectID": project.project.id,
            "projectName": project.project.name,
            "savedStates": [{
                "saveData": json.loads(state.json),
                "autosave": state.autosaved
            } for state in SavedState.objects.filter(user=request.user, project=project.project)]
        } for project in paginated_projects]

        return JsonResponse({"projects": json_objects, "endOfPagination": end_of_pagination}, status=200)

    elif request.method == "POST":
        # files = request.FILES.getlist('files')
        # TODO: The server will just have a 500 moment if something in the form is not there
        # TODO: Security concerns & Re-enable this feature
        # https://docs.djangoproject.com/en/2.2/topics/security/#user-uploaded-content-security
        # public = True if request.data["public"] == "true" else False
        try:
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
        except IntegrityError:
            response = JsonResponse({"failure": {"data": "unique_name_required"}})
            response.status_code = 401
            return response

    elif request.method == "DELETE":
        project_id = request.POST.get("id", False)
        if project_id:
            try:
                project_to_delete = Project.objects.get(id=project_id, owner=request.user)
                project_to_delete.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except ObjectDoesNotExist:
                return JsonResponse({"error": "No such project"}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_projects(request):
    if request.method == "GET":
        search_text = request.GET.get("queryText", False)
        if not search_text:
            return JsonResponse({"lol": "no"}, status=401)  # TODO: proper error
        else:
            projects = ProjectToMostRecentState.objects.filter(project__owner=request.user,
                                                               project__name__istartswith=search_text)
            json_objects = [{
                "projectID": project.project.id,
                "projectName": project.project.name,
                "savedStates": [{
                    "saveData": json.loads(state.json),
                    "autosave": state.autosaved
                } for state in SavedState.objects.filter(user=request.user, project=project.project)]
            } for project in projects]
            response = JsonResponse({"projects": json_objects}, status=200)
            return response
