from django.shortcuts import render


def clicker_index(request):
    return render(request, "clicker_index.html")


def pop_out_window(request):
    return render(request, "pop_out.html")


def documentation(request):
    return render(request, "documentation.html")
