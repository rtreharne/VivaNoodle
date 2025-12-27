import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tool", "0025_drop_legacy_instructorprofile"),
    ]

    operations = [
        migrations.CreateModel(
            name="AssignmentResourcePreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user_id", models.CharField(max_length=255)),
                ("included", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("resource", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="preferences", to="tool.assignmentresource")),
            ],
            options={
                "unique_together": {("resource", "user_id")},
            },
        ),
    ]
