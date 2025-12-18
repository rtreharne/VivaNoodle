from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tool", "0010_assignment_settings_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vivasession",
            name="submission",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="viva_sessions", to="tool.submission"),
        ),
    ]
