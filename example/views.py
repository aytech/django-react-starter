from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Example
from .serializers import ExampleSerializer


class PublicReadOnlyAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['get', 'head', 'options']

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)

        # Availability can change through Django Admin, so browsers
        # and proxies should not retain a stale response
        response["Cache-Control"] = "no-store"
        return response


class ExampleDetailView(PublicReadOnlyAPIView):
    def get(self, request):
        example = Example.objects.first() or Example()

        serializer = ExampleSerializer(example)

        return Response(serializer.data)
