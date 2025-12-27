from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tool", "0026_assignmentresourcepreference"),
    ]

    operations = [
        migrations.AddField(
            model_name="assignment",
            name="allow_early_submission",
            field=models.BooleanField(default=False),
        ),
    ]
