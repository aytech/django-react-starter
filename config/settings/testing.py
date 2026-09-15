"""Fast, isolated settings for the Django test suite."""

from .base import *  # noqa: F403

SECRET_KEY = "django-insecure-tests-only-do-not-use-in-production"
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
