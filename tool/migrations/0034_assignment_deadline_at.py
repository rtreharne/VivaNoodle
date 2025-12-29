from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0033_assignment_feedback_visibility_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="assignment",
            name="deadline_at",
            field=models.DateTimeField(blank=True, help_text="Deadline for the viva (instructor timezone).", null=True),
        ),
    ]
