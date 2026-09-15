"""Container configuration and production static-serving regression checks."""

from copy import deepcopy
from importlib.util import find_spec
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from unittest import skipUnless

from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.test import SimpleTestCase, override_settings


class ContainerSettingsTests(SimpleTestCase):
    def import_container_settings(self, **overrides):
        environment = {
            name: value
            for name, value in os.environ.items()
            if not name.startswith("DJANGO_")
        }
        environment.update(
            DJANGO_SECRET_KEY="container-settings-test-key-" + "a" * 64,
            DJANGO_ALLOWED_HOSTS="example.com",
            **overrides,
        )
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                """
import json
from config.settings import base, container

names = (
    "DEBUG", "MIDDLEWARE", "STORAGES", "SECURE_SSL_REDIRECT",
    "SESSION_COOKIE_SECURE", "CSRF_COOKIE_SECURE", "SECURE_PROXY_SSL_HEADER",
)
configuration = {name: getattr(container, name, None) for name in names}
configuration["database_path"] = str(container.DATABASES["default"]["NAME"])
configuration["base_middleware"] = base.MIDDLEWARE
print(json.dumps(configuration))
""",
            ],
            cwd=settings.BASE_DIR,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_database_path_preserves_local_default_and_supports_persistent_storage(self):
        default = self.import_container_settings()
        self.assertEqual(default["database_path"], str(settings.BASE_DIR / "db.sqlite3"))

        container = self.import_container_settings(DJANGO_DATABASE_PATH="/data/db.sqlite3")
        self.assertEqual(container["database_path"], "/data/db.sqlite3")

    def test_container_keeps_secure_defaults_and_adds_static_serving(self):
        container = self.import_container_settings()

        self.assertFalse(container["DEBUG"])
        self.assertTrue(container["SECURE_SSL_REDIRECT"])
        self.assertTrue(container["SESSION_COOKIE_SECURE"])
        self.assertTrue(container["CSRF_COOKIE_SECURE"])
        self.assertIsNone(container["SECURE_PROXY_SSL_HEADER"])
        self.assertEqual(
            container["MIDDLEWARE"][:2],
            [
                "django.middleware.security.SecurityMiddleware",
                "whitenoise.middleware.WhiteNoiseMiddleware",
            ],
        )
        self.assertNotIn(
            "whitenoise.middleware.WhiteNoiseMiddleware", container["base_middleware"]
        )
        self.assertEqual(
            container["STORAGES"]["default"]["BACKEND"],
            "django.core.files.storage.FileSystemStorage",
        )

    def test_proxy_trust_and_redirect_override_require_explicit_environment_values(self):
        container = self.import_container_settings(
            DJANGO_TRUST_PROXY_HEADERS="1", DJANGO_SECURE_SSL_REDIRECT="0"
        )
        self.assertEqual(
            container["SECURE_PROXY_SSL_HEADER"], ["HTTP_X_FORWARDED_PROTO", "https"]
        )
        self.assertFalse(container["SECURE_SSL_REDIRECT"])
        self.assertTrue(container["SESSION_COOKIE_SECURE"])
        self.assertTrue(container["CSRF_COOKIE_SECURE"])

        untrusted = self.import_container_settings(DJANGO_TRUST_PROXY_HEADERS="0")
        self.assertIsNone(untrusted["SECURE_PROXY_SSL_HEADER"])

    @skipUnless(
        find_spec("whitenoise") is not None,
        "Install docker/requirements.txt to run the production static-serving test.",
    )
    def test_production_container_serves_react_html_and_collected_assets(self):
        container = self.import_container_settings()
        with TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / "dist"
            dist.mkdir()
            asset_url = "/static/client/assets/app.js"
            (dist / "index.html").write_text(
                f'<!doctype html><div id="root"></div><script src="{asset_url}"></script>',
                encoding="utf-8",
            )
            static_root = root / "staticfiles"
            asset = static_root / "client" / "assets" / "app.js"
            asset.parent.mkdir(parents=True)
            asset.write_text(
                'document.querySelector("#root").textContent = "Ready";', encoding="utf-8"
            )
            templates = deepcopy(settings.TEMPLATES)
            templates[0]["DIRS"] = [dist]

            with override_settings(
                DEBUG=False,
                ALLOWED_HOSTS=["testserver"],
                MIDDLEWARE=container["MIDDLEWARE"],
                STORAGES=container["STORAGES"],
                SECURE_SSL_REDIRECT=container["SECURE_SSL_REDIRECT"],
                STATIC_ROOT=static_root,
                STATICFILES_DIRS=[],
                TEMPLATES=templates,
            ):
                self.assertContains(self.client.get("/", secure=True), asset_url)
                self.assertEqual(staticfiles_storage.url("client/assets/app.js"), asset_url)

                response = self.client.get(asset_url, secure=True)
                try:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(b"".join(response.streaming_content), asset.read_bytes())
                    self.assertIn("javascript", response["Content-Type"])
                finally:
                    response.close()
