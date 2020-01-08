import json

from django.http import JsonResponse
from django.utils.timezone import now
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from CLICKER.models import SavedState, Project


# TODO SERIALIZATION

@api_view(["GET", "POST"])
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
            user_states = saved_state_query_set[query_set_length - 6: query_set_length - 1]

        else:
            if len(user_states) < 5: end_of_pagination = True

        json_objects = [json.loads(state.json) for state in user_states]
        try:
            user_autosaved_state = SavedState.objects.get(user=request.user, autosaved=True)
            json_objects.append(json.loads(user_autosaved_state.json[0:-2] + r',\"autosaved\": true }"'))
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
        print(auto_save)
        auto_save = True if len(auto_save) > 0 else False

        date_created = now()

        # TODO: SERIALIZATION
        if auto_save:
            SavedState.objects.filter(user=request.user, autosaved=auto_save).update(json=json.dumps(data))
        else:
            SavedState.objects.create(
                user=request.user,
                json=json.dumps(data),
                autosaved=auto_save,
                date_created=date_created
            )

        response = JsonResponse({"success": "none"})
        response.status_code = 200
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
        response = JsonResponse({"success": "cool"})
        response.status_code = 200
        return response
