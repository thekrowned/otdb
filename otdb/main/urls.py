from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("users/<int:id>/", views.user, name="user"),
    path("google-auth", views.go_google_auth),
    path("google-auth-callback", views.handle_google_auth)
]
