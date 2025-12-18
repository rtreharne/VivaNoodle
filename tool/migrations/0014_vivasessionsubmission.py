from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0013_vivasession_rating"),
    ]

    operations = [
        migrations.CreateModel(
            name="VivaSessionSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("included", models.BooleanField(default=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submission_links", to="tool.vivasession")),
                ("submission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="viva_links", to="tool.submission")),
            ],
            options={
                "unique_together": {("session", "submission")},
            },
        ),
    ]
