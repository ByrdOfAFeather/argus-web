# Generated by Django 3.1 on 2020-09-11 20:03

from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('CLICKER', '0001_initial'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='project',
            unique_together={('owner', 'name')},
        ),
    ]
