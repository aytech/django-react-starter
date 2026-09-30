from copy import deepcopy
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
from tempfile import TemporaryDirectory

from django.conf import settings
from django.test import SimpleTestCase, override_settings
from django.urls import resolve, reverse


class ClientRoutingTests(SimpleTestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        dist = Path(directory.name) / "dist"
        dist.mkdir()
        (dist / "index.html").write_text(
            '<!doctype html><html><body><div id="root"></div>'
            '<script type="module" src="/static/client/assets/app.js"></script>'
            "</body></html>",
            encoding="utf-8",
        )
        templates = deepcopy(settings.TEMPLATES)
        templates[0]["DIRS"] = [dist]
        self.enterContext(override_settings(TEMPLATES=templates))

    def test_index_renders_the_frontend_entry_point(self):
        response = self.client.get(reverse("client:index"))

        self.assertTemplateUsed(response, "index.html")
        self.assertContains(response, '<div id="root"></div>')
        self.assertContains(response, "/static/client/assets/app.js")

    def test_admin_uses_its_own_routes(self):
        self.assertEqual(resolve("/admin/").view_name, "admin:index")
        response = self.client.get("/admin/")

        self.assertRedirects(
            response, "/admin/login/?next=/admin/", fetch_redirect_response=False
        )

    def test_unknown_routes_are_not_rendered_as_the_frontend(self):
        for path in ("/unknown/", "/api/missing", "/static/missing"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_api_auth_is_not_exposed_when_debug_is_disabled(self):
        self.assertFalse(settings.DEBUG)
        self.assertEqual(self.client.get("/api-auth/login/").status_code, 404)


class DevelopmentSettingsTests(SimpleTestCase):
    def run_with_development_settings(self, code):
        environment = os.environ.copy()
        environment["DJANGO_SETTINGS_MODULE"] = "config.settings.development"

        return subprocess.run(
            [
                sys.executable,
                "-c",
                code,
            ],
            cwd=settings.BASE_DIR,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

    def test_defaults_are_explicitly_development_only(self):
        result = self.run_with_development_settings(
            """
import json
from config.settings import development

names = ("DEBUG", "SECRET_KEY", "ALLOWED_HOSTS")
print(json.dumps({name: getattr(development, name) for name in names}))
"""
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        development = json.loads(result.stdout)
        self.assertTrue(development["DEBUG"])
        self.assertEqual(
            development["SECRET_KEY"],
            "django-insecure-local-development-only-do-not-use-in-production",
        )
        self.assertEqual(
            development["ALLOWED_HOSTS"],
            ["localhost", "127.0.0.1", "[::1]"],
        )

    def test_api_auth_route_is_enabled_for_development(self):
        result = self.run_with_development_settings(
            """
import django
import json

django.setup()

from django.urls import resolve

match = resolve("/api-auth/login/")
print(json.dumps({"view_name": match.view_name}))
"""
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        route = json.loads(result.stdout)
        self.assertEqual(route["view_name"], "rest_framework:login")


class ProductionSettingsTests(SimpleTestCase):
    def import_production_settings(self, **overrides):
        environment = os.environ.copy()
        for name in (
            "DJANGO_SETTINGS_MODULE",
            "DJANGO_SECRET_KEY",
            "DJANGO_ALLOWED_HOSTS",
            "DJANGO_CSRF_TRUSTED_ORIGINS",
        ):
            environment.pop(name, None)
        environment.update(
            DJANGO_SECRET_KEY=secrets.token_urlsafe(48),
            DJANGO_ALLOWED_HOSTS="example.com",
        )
        for name, value in overrides.items():
            if value is None:
                environment.pop(name, None)
            else:
                environment[name] = value

        return subprocess.run(
            [
                sys.executable,
                "-c",
                """
import json
from config.settings import production

names = (
    "DEBUG", "ALLOWED_HOSTS", "CSRF_TRUSTED_ORIGINS",
    "SECURE_SSL_REDIRECT", "SESSION_COOKIE_SECURE",
    "CSRF_COOKIE_SECURE", "SECURE_HSTS_SECONDS",
)
print(json.dumps({name: getattr(production, name) for name in names}))
""",
            ],
            cwd=settings.BASE_DIR,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

    def test_missing_or_unsafe_secret_keys_are_rejected(self):
        for secret in (None, "short-key", "django-insecure-" + "a" * 60):
            with self.subTest(secret=secret):
                result = self.import_production_settings(DJANGO_SECRET_KEY=secret)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ImproperlyConfigured", result.stderr)
                self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_empty_or_wildcard_hosts_are_rejected(self):
        for hosts in ("", "*"):
            with self.subTest(hosts=hosts):
                result = self.import_production_settings(DJANGO_ALLOWED_HOSTS=hosts)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ImproperlyConfigured", result.stderr)
                self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_valid_configuration_enables_https_defaults(self):
        result = self.import_production_settings(
            DJANGO_ALLOWED_HOSTS="example.com, app.example.com",
            DJANGO_CSRF_TRUSTED_ORIGINS="https://example.com, https://app.example.com",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        production = json.loads(result.stdout)
        self.assertFalse(production["DEBUG"])
        self.assertEqual(production["ALLOWED_HOSTS"], ["example.com", "app.example.com"])
        self.assertEqual(
            production["CSRF_TRUSTED_ORIGINS"],
            ["https://example.com", "https://app.example.com"],
        )
        self.assertTrue(production["SECURE_SSL_REDIRECT"])
        self.assertTrue(production["SESSION_COOKIE_SECURE"])
        self.assertTrue(production["CSRF_COOKIE_SECURE"])
        self.assertGreater(production["SECURE_HSTS_SECONDS"], 0)
