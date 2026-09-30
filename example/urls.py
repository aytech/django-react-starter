from django.urls import path

from .views import ExampleDetailView

app_name = "example-api"

urlpatterns = [
    path("", ExampleDetailView.as_view(), name="example-detail"),
]
