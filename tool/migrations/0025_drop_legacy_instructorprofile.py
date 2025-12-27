from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tool", "0024_rename_tool_assign_token_0ca1b2_idx_tool_assign_token_529526_idx_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS tool_instructorprofile;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
