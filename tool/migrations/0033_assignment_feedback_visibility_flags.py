from django.db import migrations, models


def _seed_feedback_flags(apps, schema_editor):
    Assignment = apps.get_model("tool", "Assignment")
    for assignment in Assignment.objects.all():
        visibility = (assignment.feedback_visibility or "immediate").lower()
        if visibility == "hidden":
            assignment.ai_feedback_visible = False
            assignment.teacher_feedback_visible = False
        elif visibility == "after_review":
            assignment.ai_feedback_visible = False
            assignment.teacher_feedback_visible = True
        else:
            assignment.ai_feedback_visible = True
            assignment.teacher_feedback_visible = True
        assignment.save(update_fields=["ai_feedback_visible", "teacher_feedback_visible"])


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0032_vivasession_teacher_feedback_author"),
    ]

    operations = [
        migrations.AddField(
            model_name="assignment",
            name="ai_feedback_visible",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="assignment",
            name="teacher_feedback_visible",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(_seed_feedback_flags, migrations.RunPython.noop),
    ]
