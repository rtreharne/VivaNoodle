from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0031_assignment_feedback_release_and_teacher_feedback"),
    ]

    operations = [
        migrations.AddField(
            model_name="vivasession",
            name="teacher_feedback_author",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="viva_teacher_feedback",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
