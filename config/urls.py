"""Project URL configuration."""

from django.contrib import admin
from django.urls import include, path
from django.conf import settings

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/example/", include("example.urls")),
]

if settings.DEBUG:
    urlpatterns.append(
        path("api-auth/", include("rest_framework.urls")),
    ),

urlpatterns += [
    path("", include("client.urls")),
]
