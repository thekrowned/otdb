from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("auth/", views.authenticate, name="auth"),
    path("logout/", views.unauthenticate, name="logout"),
    path("dashboard/", views.dashboard, name="dashboard"),
]
