from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from session_management.models import Session
from session_management.serializers import SessionSerializer
from django.contrib.auth.models import User
from session_management.utils import generate_session_id
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.http import JsonResponse


@api_view(['POST'])
def create_session(request):
    username = request.data.get('username')
    session_name = request.data.get('session_name')

    if not session_name:
        return Response({'error': 'Session name is required'}, status=status.HTTP_400_BAD_REQUEST)

    user, created = User.objects.get_or_create(username=username)

    session = Session.objects.create(
        name=session_name,
        created_by=user,
        session_id=generate_session_id()
    )

    # Add the creator as a participant
    session.participants.set([user])

    serializer = SessionSerializer(session)
    return Response({
        'message': 'Session created successfully!',
        'session': serializer.data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_session_participants(request, session_id):
    try:
        session = Session.objects.get(session_id=session_id)
        participants = session.participants.all()
        participants_names = [user.username for user in participants]
        return Response({'participants': participants_names}, status=status.HTTP_200_OK)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def join_session(request):
    username = request.data.get('username')
    session_id = request.data.get('sessionId')

    try:
        session = Session.objects.get(session_id=session_id)
        user, created = User.objects.get_or_create(username=username)
        session.participants.add(user)
        return Response({'message': 'Joined session successfully!'}, status=status.HTTP_200_OK)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def cast_vote(request, session_id):
    username = request.data.get('username')
    vote = request.data.get('vote')
    is_spectator = request.data.get('is_spectator', False)
    # Fetch the session based on session_id
    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    # Update the votes
    if username and vote:
        session.votes[username] = {'vote': vote, 'is_spectator': is_spectator}
        session.save()
        return Response({'message': 'Vote recorded successfully!'}, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid vote data'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_votes(request, session_id):
    try:
        session = Session.objects.get(session_id=session_id)
        return Response({'votes': session.votes}, status=status.HTTP_200_OK)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def clear_vote(request, session_id):
    username = request.data.get('username')

    # Fetch the session based on session_id
    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    # Remove the vote for the user
    if username in session.votes:
        session.votes[username]['vote'] = None
        session.save()
        return Response({'message': 'Vote cleared successfully!'}, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'No vote found for this user'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def flip_votes(request, session_id):
    # Fetch the session based on session_id
    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    # Check if all participants have voted
    participants = session.participants.all()
    participants_names = [user.username for user in participants]
    all_voted = all(user in session.votes for user in participants_names)

    if not all_voted:
        return Response({'error': 'Not all participants have voted'}, status=status.HTTP_400_BAD_REQUEST)

    # If all have voted, prepare the vote results and save them in the session
    vote_results = {user: session.votes[user] for user in participants_names}
    session.vote_results = vote_results  # Store the results in the session
    session.save()

    return Response({'vote_results': vote_results}, status=status.HTTP_200_OK)


@api_view(['POST'])
def reset_votes(request, session_id):
    # Fetch the session based on session_id
    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    # Reset all votes to null while keeping is_spectator intact
    for username, vote_info in session.votes.items():
        vote_info['vote'] = None

    session.save()
    return Response({'message': 'Votes have been reset successfully!'}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_session_details(request, session_id):
    try:
        session = Session.objects.get(session_id=session_id)
        participants = session.participants.all()
        participants_names = [user.username for user in participants]
        return Response({
            'name': session.name,
            'created_by': session.created_by.username,
            'participants': participants_names,
            'votes': session.votes,
        }, status=status.HTTP_200_OK)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def make_spectator(request, session_id):
    try:
        session = Session.objects.get(session_id=session_id)
        is_spectator = request.data.get('is_spectator', False)
        username = request.data.get('username')
        vote = request.data.get('vote', None)
        if username:
            session.votes.setdefault(username, {})['vote'] = vote  # Use setdefault
            session.votes[username]['is_spectator'] = is_spectator
            session.save()
            return Response({'message': f'User {username} is spectator {is_spectator}'}, status=status.HTTP_200_OK)

    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def remove_user(request, session_id):
    username_to_remove = request.data.get('username')
    if not username_to_remove:
        return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        user_to_remove = User.objects.get(username=username_to_remove)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if session.created_by == user_to_remove:
        return Response({'error': 'The Creator cannot remove themselves from the session.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the user is a participant in the session
    if user_to_remove in session.participants.all():
        session.participants.remove(user_to_remove)
        session.save()
        return Response({'message': f'{username_to_remove} has been removed from the session.'}, status=status.HTTP_200_OK)
    else:
        return Response({'error': f'{username_to_remove} is not a participant in this session.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_session(request, session_id):
    try:
        session = Session.objects.get(session_id=session_id)
        session.delete()
        return Response({'message': 'Session Deleted successfully!'}, status=status.HTTP_200_OK)

    except Session.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
