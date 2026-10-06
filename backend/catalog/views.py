import json

from rest_framework import serializers, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import CatalogPermission
from catalog.models import (
    ClientType,
    CompanyProfile,
    Currency,
    Destination,
    ExpenseCategory,
    LeadSource,
    PaymentMethod,
    SafariType,
    VendorType,
)


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ["id", "code", "name", "is_active", "created_at"]

    def validate_code(self, value):
        return value.strip().upper()


class NamedSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ["id", "name", "is_active", "created_at"]


def named_serializer(model):
    meta = type("Meta", (), {"model": model, "fields": NamedSerializer.Meta.fields})
    return type(f"{model.__name__}Serializer", (serializers.ModelSerializer,), {"Meta": meta})


from catalog.serializers import CompanySerializer


class BrandingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        profile = CompanyProfile.load()
        return Response(CompanySerializer(profile, context={"request": request}).data)


class CompanyView(APIView):
    permission_classes = [CatalogPermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        profile = CompanyProfile.load()
        return Response(CompanySerializer(profile, context={"request": request}).data)

    def _save(self, request):
        profile = CompanyProfile.load()
        data = request.data
        if hasattr(data, "lists"):
            payload = {key: data.get(key) for key in data}
            if "logo" in request.FILES:
                payload["logo"] = request.FILES["logo"]
            banks = payload.get("banks")
            if isinstance(banks, str):
                try:
                    payload["banks"] = json.loads(banks or "[]")
                except json.JSONDecodeError as exc:
                    raise serializers.ValidationError({"banks": "Bank details could not be read."}) from exc
        else:
            payload = data
        serializer = CompanySerializer(profile, data=payload, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(CompanySerializer(profile, context={"request": request}).data)

    def put(self, request):
        return self._save(request)

    def patch(self, request):
        return self._save(request)


class CatalogViewSet(viewsets.ModelViewSet):
    permission_classes = [CatalogPermission]
    pagination_class = None
    search_fields = ["name"]
    filterset_fields = ["is_active"]


def catalog_viewset(model, serializer):
    return type(
        f"{model.__name__}ViewSet",
        (CatalogViewSet,),
        {"queryset": model.objects.all(), "serializer_class": serializer},
    )


CurrencyViewSet = catalog_viewset(Currency, CurrencySerializer)
CurrencyViewSet.search_fields = ["code", "name"]
PaymentMethodViewSet = catalog_viewset(PaymentMethod, named_serializer(PaymentMethod))
DestinationViewSet = catalog_viewset(Destination, named_serializer(Destination))
SafariTypeViewSet = catalog_viewset(SafariType, named_serializer(SafariType))
LeadSourceViewSet = catalog_viewset(LeadSource, named_serializer(LeadSource))
ClientTypeViewSet = catalog_viewset(ClientType, named_serializer(ClientType))
ExpenseCategoryViewSet = catalog_viewset(ExpenseCategory, named_serializer(ExpenseCategory))
VendorTypeViewSet = catalog_viewset(VendorType, named_serializer(VendorType))
