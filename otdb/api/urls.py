from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from . import views

urlpatterns = [
    # tournaments
    path("tournaments/", views.tournaments, name="api_tournaments"),
    path("tournaments/<int:id>/", views.tournaments, name="api_tournament"),
    path("tournaments/<int:tournament_id>/favorite/", views.favorite_tournament, name="api_favorite_tournament"),
    path("tournaments/search/", views.search_tournaments, name="search_tournaments"),

    # mappools
    path("mappools/", views.mappools, name="api_mappools"),
    path("mappools/<int:mappool_id>/", views.mappools, name="api_mappool"),
    path("mappools/<int:mappool_id>/favorite/", views.favorite_mappool, name="api_favorite_mappool"),
    path("mappools/search/", views.search_mappools, name="search_mappools"),

    path("users/<int:id>/", views.users, name="api_users"),
]
