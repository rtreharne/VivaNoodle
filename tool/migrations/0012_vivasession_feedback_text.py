from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0011_vivasession_submission_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="vivasession",
            name="feedback_text",
            field=models.TextField(blank=True),
        ),
    ]
