from django.urls import path
from . import views

urlpatterns = [
    path("mappools/", views.mappools, name="mappools"),
    path("mappools/<int:id>/", views.mappools, name="mappool"),
    path("mappools/<int:id>/edit/", views.edit_mappool, name="edit_mappool"),
    path("mappools/new/", views.new_mappool, name="new_mappool"),

    path("tournaments/", views.tournaments, name="tournaments"),
    path("tournaments/<int:id>/", views.tournaments, name="tournament"),
    path("tournaments/<int:id>/edit/", views.edit_tournament, name="edit_tournament"),
    path("tournaments/new/", views.new_tournament, name="new_tournament")
]
