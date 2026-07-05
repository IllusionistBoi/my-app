from django.urls import path

from . import views


urlpatterns = [
    path("create/", views.create_session, name="create_session"),
    path("join/", views.join_session, name="join_session"),
    path("<str:session_id>/cast_vote/", views.cast_vote, name="cast_vote"),
    path("<str:session_id>/clear_vote/", views.clear_vote, name="clear_vote"),
    path("<str:session_id>/flip_votes/", views.flip_votes, name="flip_votes"),
    path("<str:session_id>/reset_votes/", views.reset_votes, name="reset_votes"),
    path(
        "<str:session_id>/details/",
        views.get_session_details,
        name="get_session_details",
    ),
    path(
        "<str:session_id>/make_spectator/",
        views.make_spectator,
        name="make_spectator",
    ),
    path("<str:session_id>/remove_user/", views.remove_user, name="remove_user"),
    path(
        "<str:session_id>/delete_session/",
        views.delete_session,
        name="delete_session",
    ),
]
