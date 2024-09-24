from rest_framework import serializers
from .models import Session, UserSession


class SessionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Session
        fields = ['id', 'session_id', 'name', 'created_by', 'created_at', 'votes']


class UserSessionSerializer(serializers.ModelSerializer):

    class Meta:
        model = UserSession
        fields = ['user', 'session', 'joined_at']
