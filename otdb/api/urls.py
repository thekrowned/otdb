from django.urls import path
from .views import tournaments, mappools, users

urlpatterns = [
    # tournaments
    path("tournaments/", tournaments.tournaments),
    path("tournaments/<int:id>/", tournaments.tournaments),
    path("tournaments/<int:tournament_id>/favorite/", tournaments.favorite_tournament),

    # mappools
    path("mappools/", mappools.mappools),
    path("mappools/<int:mappool_id>/", mappools.mappools),
    path("mappools/<int:mappool_id>/favorite/", mappools.favorite_mappool),

    # users
    path("users/<int:id>/", users.users),
]
