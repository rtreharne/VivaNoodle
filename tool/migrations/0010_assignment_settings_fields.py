# Generated manually to add viva settings fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tool', '0009_vivafeedback'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='additional_prompts',
            field=models.TextField(blank=True, help_text='Extra prompts or instructions for this viva (shown to AI).'),
        ),
        migrations.AddField(
            model_name='assignment',
            name='allow_student_report',
            field=models.BooleanField(default=True, help_text='Allow students to download their transcript/feedback.'),
        ),
        migrations.AddField(
            model_name='assignment',
            name='feedback_visibility',
            field=models.CharField(default='immediate', help_text='When students can see AI feedback: immediate, after_review, or hidden.', max_length=50),
        ),
        migrations.AddField(
            model_name='assignment',
            name='max_attempts',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='assignment',
            name='viva_tone',
            field=models.CharField(default='Supportive', help_text='Tone for AI questioning, e.g., Supportive, Neutral, Probing, Peer-like.', max_length=50),
        ),
    ]
