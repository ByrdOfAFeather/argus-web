import json

from django.http import JsonResponse
from rest_framework.decorators import api_view

from CLICKER.models import SavedState


@api_view(["GET", "POST"])
def saved_states(request):
    if request.method == "GET":
        user_states = SavedState.objects.filter(user=request.user)

        json_objects = []
        for state in user_states:
            json_objects.append(json.loads(state.json))

        response = JsonResponse({"states": json_objects})
        response.status_code = 200
        return response
    elif request.method == "POST":
        data = request.POST.get("json", "")
        auto_save = request.POST.get("autosave", "")
        print(auto_save)
        auto_save = True if len(auto_save) > 0 else False

        # TODO: SERIALIZATION
        if auto_save:
            SavedState.objects.filter(user=request.user, autosaved=auto_save).update(json=json.dumps(data))
        else:
            SavedState.objects.create(
                user=request.user,
                json=json.dumps(data),
                autosaved=auto_save
            )

        response = JsonResponse({"success": "none"})
        response.status_code = 200
        return response

