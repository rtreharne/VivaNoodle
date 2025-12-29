from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Assignment(models.Model):
    slug = models.SlugField(unique=True)  # matches Canvas resource_link_id
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    allow_multiple_submissions = models.BooleanField(default=False)
    max_attempts = models.IntegerField(default=1)
    viva_duration_seconds = models.IntegerField(default=600)  # 10 minutes default
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="owned_assignments",
        null=True,
        blank=True,
    )

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
        help_text="Legacy AI feedback visibility flag."
    )
    ai_feedback_visible = models.BooleanField(
        default=True,
        help_text="Allow students to see AI feedback."
    )
    teacher_feedback_visible = models.BooleanField(
        default=True,
        help_text="Allow students to see teacher feedback."
    )
    feedback_released_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Legacy AI feedback release timestamp."
    )

    allow_student_report = models.BooleanField(
        default=True,
        help_text="Allow students to download their transcript/feedback."
    )
    allow_early_submission = models.BooleanField(
        default=False,
        help_text="Allow students to submit the viva before time expires."
    )
    deadline_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline for the viva (instructor timezone)."
    )

    additional_prompts = models.TextField(
        blank=True,
        help_text="Extra prompts or instructions for this viva (shown to AI)."
    )

    keystroke_tracking = models.BooleanField(default=True)
    event_tracking = models.BooleanField(default=True)
    arrhythmic_typing = models.BooleanField(default=True)
    enable_model_answers = models.BooleanField(default=True)
    allow_student_resource_toggle = models.BooleanField(default=False)
    self_enroll_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    self_enroll_domain = models.CharField(max_length=255, blank=True, default="")


    def __str__(self):
        return self.title


class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    user_id = models.CharField(max_length=255)  # From LTI claim: sub
    created_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to="submissions/")
    comment = models.TextField(blank=True)
    is_placeholder = models.BooleanField(default=False)

    # Optional: store grade if using AGS later
    grade = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.user_id} → {self.assignment.title}"


class AssignmentResource(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="resources")
    file = models.FileField(upload_to="assignment_resources/")
    comment = models.TextField(blank=True)
    included = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        file_name = self.file.name if self.file else "resource"
        return f"{self.assignment.title} → {file_name}"

class AssignmentResourcePreference(models.Model):
    resource = models.ForeignKey(AssignmentResource, on_delete=models.CASCADE, related_name="preferences")
    user_id = models.CharField(max_length=255)
    included = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("resource", "user_id")

    def __str__(self):
        file_name = self.resource.file.name if self.resource and self.resource.file else "resource"
        return f"{self.user_id} preference for {file_name}"

class VivaSession(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="viva_sessions")
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)  # optional
    feedback_text = models.TextField(blank=True)
    teacher_feedback_text = models.TextField(blank=True)
    teacher_feedback_author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="viva_teacher_feedback",
    )
    rating = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Viva for {self.submission.user_id} (session {self.id})"


class VivaMessage(models.Model):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE)
    sender = models.CharField(max_length=20)  # "student" or "ai"
    text = models.TextField()
    model_answer = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)


class VivaSessionSubmission(models.Model):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE, related_name="submission_links")
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="viva_links")
    included = models.BooleanField(default=True)

    class Meta:
        unique_together = ("session", "submission")


class VivaSessionResource(models.Model):
    session = models.ForeignKey(VivaSession, on_delete=models.CASCADE, related_name="resource_links")
    resource = models.ForeignKey(AssignmentResource, on_delete=models.CASCADE, related_name="session_links")
    included = models.BooleanField(default=True)

    class Meta:
        unique_together = ("session", "resource")


class InteractionLog(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=50)   # "keypress", "paste", "blur", etc.
    event_data = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

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


class UserProfile(models.Model):
    ROLE_INSTRUCTOR = "instructor"
    ROLE_STUDENT = "student"
    ROLE_CHOICES = [
        (ROLE_INSTRUCTOR, "Instructor"),
        (ROLE_STUDENT, "Student"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    institution_type = models.CharField(max_length=50, blank=True)
    institution_name = models.CharField(max_length=255, blank=True)
    verification_token = models.CharField(max_length=100, blank=True)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.email or self.user.username} ({self.get_role_display()})"


class AssignmentMembership(models.Model):
    ROLE_STUDENT = "student"
    ROLE_INSTRUCTOR = "instructor"
    ROLE_CHOICES = [
        (ROLE_STUDENT, "Student"),
        (ROLE_INSTRUCTOR, "Instructor"),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assignment_memberships")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="sent_memberships",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("assignment", "user")

    def __str__(self):
        return f"{self.assignment.title} → {self.user} ({self.get_role_display()})"


class AssignmentInvitation(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True)
    role = models.CharField(
        max_length=20,
        choices=AssignmentMembership.ROLE_CHOICES,
        default=AssignmentMembership.ROLE_STUDENT,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="sent_invitations",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="accepted_invitations",
        null=True,
        blank=True,
    )
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["email"]),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        status = "accepted" if self.accepted_at else "pending"
        return f"Invite to {self.email} for {self.assignment.title} ({status})"
