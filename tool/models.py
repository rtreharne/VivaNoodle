from django.db import models

class Assignment(models.Model):
    slug = models.SlugField(unique=True)  # matches Canvas resource_link_id
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    allow_multiple_submissions = models.BooleanField(default=False)
    max_attempts = models.IntegerField(default=1)
    viva_duration_seconds = models.IntegerField(default=600)  # 10 minutes default

    # NEW FIELDS
    viva_instructions = models.TextField(
        blank=True,
        help_text="Guidance for how the AI should conduct the viva (tone, focus, probing depth, do/don't)."
    )

    instructor_notes = models.TextField(
        blank=True,
        help_text="Private instructor notes about the assignment or viva. Not visible to students."
    )

    viva_tone = models.CharField(
        max_length=50,
        default="Supportive",
        help_text="Tone for AI questioning, e.g., Supportive, Neutral, Probing, Peer-like."
    )

    feedback_visibility = models.CharField(
        max_length=50,
        default="immediate",
        help_text="When students can see AI feedback: immediate, after_review, or hidden."
    )

    allow_student_report = models.BooleanField(
        default=True,
        help_text="Allow students to download their transcript/feedback."
    )

    additional_prompts = models.TextField(
        blank=True,
        help_text="Extra prompts or instructions for this viva (shown to AI)."
    )

    keystroke_tracking = models.BooleanField(default=True)
    event_tracking = models.BooleanField(default=True)
    arrhythmic_typing = models.BooleanField(default=True)


    def __str__(self):
        return self.title


class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    user_id = models.CharField(max_length=255)  # From LTI claim: sub
    created_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to="submissions/")
    comment = models.TextField(blank=True)

    # Optional: store grade if using AGS later
    grade = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.user_id} → {self.assignment.title}"
    
class VivaSession(models.Model):
    submission = models.OneToOneField(Submission, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)  # optional

    def __str__(self):
        return f"Viva for {self.submission.user_id}"


class VivaMessage(models.Model):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE)
    sender = models.CharField(max_length=20)  # "student" or "ai"
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)


class InteractionLog(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=50)   # "keypress", "paste", "blur", etc.
    event_data = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)


from django.db import models

class ToolConfig(models.Model):
    """
    Stores Canvas platform details.
    Behaviour will be added later.
    """
    platform = models.CharField(max_length=255, default="Canvas", unique=True)

    issuer = models.CharField(max_length=255)
    jwks_url = models.URLField()
    authorize_url = models.URLField()
    redirect_uri = models.URLField()
    token_url = models.URLField()
    client_id = models.CharField(max_length=255)
    deployment_id = models.CharField(max_length=255)

    last_seen_kid = models.CharField(max_length=255, blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.platform} configuration"
    

class VivaFeedback(models.Model):
    """
    Structured qualitative feedback after viva.
    Students see only academic feedback (no behavioural data).
    """
    session = models.OneToOneField(VivaSession, on_delete=models.CASCADE)

    strengths = models.TextField(blank=True)
    improvements = models.TextField(blank=True)
    misconceptions = models.TextField(blank=True)
    impression = models.TextField(blank=True)  # overall academic impression

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback for session {self.session.id}"


