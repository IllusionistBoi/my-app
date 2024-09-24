from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_session, name='create_session'),
    path('join/', views.join_session, name='join_session'),
    path('<str:session_id>/participants/', views.get_session_participants, name='get_session_participants'),
    path('<str:session_id>/cast_vote/', views.cast_vote, name='cast_vote'),  # New vote endpoint
    path('<str:session_id>/votes/', views.get_votes, name='get-votes'),  # New endpoint
    path('<str:session_id>/clear_vote/', views.clear_vote, name='clear_vote'),  # New endpoint
    path('<str:session_id>/flip_votes/', views.flip_votes, name='flip_votes'),  # New endpoint
    path('<str:session_id>/reset_votes/', views.reset_votes, name='reset_votes'),  # New endpoint
    path('<str:session_id>/details/', views.get_session_details, name='get_session_details'),

]
