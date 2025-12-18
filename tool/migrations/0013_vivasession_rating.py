from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0012_vivasession_feedback_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="vivasession",
            name="rating",
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
