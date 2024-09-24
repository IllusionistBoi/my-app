from django.db import models
from django.contrib.auth.models import User


class Session(models.Model):
    session_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    participants = models.ManyToManyField(User, related_name='sessions', blank=True)
    votes = models.JSONField(default=dict)  # Store participant votes

    def __str__(self):
        return self.name


class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    session = models.ForeignKey(Session, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'session')

    def __str__(self):
        return f"{self.user.username} in {self.session.name}"
