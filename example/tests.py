from django.test import TestCase
from django.urls import reverse

from .models import Example


class ExampleModelTests(TestCase):
    def test_defaults_provide_starter_content(self):
        example = Example()

        self.assertEqual(example.name, "Django + React")
        self.assertEqual(example.title, "This is the starter project")
        self.assertEqual(str(example), "Django + React")


class ExampleAPITests(TestCase):
    def setUp(self):
        self.url = reverse("example-api:example-detail")

    def test_endpoint_uses_expected_url(self):
        self.assertEqual(self.url, "/api/v1/example/")

    def test_returns_defaults_without_creating_a_record(self):
        response = self.client.get(
            self.url,
            headers={"accept": "application/json"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "name": "Django + React",
            "title": "This is the starter project",
        })
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertFalse(Example.objects.exists())

    def test_returns_the_first_configured_record(self):
        Example.objects.create(
            name="Configured name",
            title="Configured title",
        )

        response = self.client.get(
            self.url,
            headers={"accept": "application/json"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "name": "Configured name",
            "title": "Configured title",
        })

    def test_endpoint_rejects_writes(self):
        response = self.client.post(
            self.url,
            data={"name": "Changed", "title": "Changed"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 405)
