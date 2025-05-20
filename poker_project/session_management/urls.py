from django.urls import path
from . import views

urlpatterns = [
    # NOT USED
    path('<str:session_id>/participants/', views.get_session_participants, name='get_session_participants'),
    path('<str:session_id>/votes/', views.get_votes, name='get-votes'),

    # Used to create, Join
    path('create/', views.create_session, name='create_session'),
    path('join/', views.join_session, name='join_session'),
    # Used in cast vote
    path('<str:session_id>/cast_vote/', views.cast_vote, name='cast_vote'),
    # Used in clearVote
    path('<str:session_id>/clear_vote/', views.clear_vote, name='clear_vote'),
    #  Used in handleFlipVotes
    path('<str:session_id>/flip_votes/', views.flip_votes, name='flip_votes'),
    # Used in handleResetVotes
    path('<str:session_id>/reset_votes/', views.reset_votes, name='reset_votes'),
    #  Used in fetchSessionDetails
    path('<str:session_id>/details/', views.get_session_details, name='get_session_details'),
    # Used in handleUserStatus
    path('<str:session_id>/make_spectator/', views.make_spectator, name='make_spectator'),
    # Used in handleRemoveUser
    path('<str:session_id>/remove_user/', views.remove_user, name='remove_user'),
    path('<str:session_id>/delete_session/', views.delete_session, name='delete_session'),

]
