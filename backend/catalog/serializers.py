from rest_framework import serializers

from catalog.logo import logo_variants
from catalog.models import CompanyProfile


class CompanySerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    logo_dark_url = serializers.SerializerMethodField()
    logo_mark_url = serializers.SerializerMethodField()
    logo_mark_dark_url = serializers.SerializerMethodField()
    logo_wide_url = serializers.SerializerMethodField()
    logo_wide_dark_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanyProfile
        fields = [
            "name",
            "email",
            "phone",
            "address",
            "tagline",
            "welcome_title",
            "welcome_text",
            "logo_url",
            "logo_dark_url",
            "logo_mark_url",
            "logo_mark_dark_url",
            "logo_wide_url",
            "logo_wide_dark_url",
            "primary_color",
            "secondary_color",
        ]
        read_only_fields = [
            "logo_url",
            "logo_dark_url",
            "logo_mark_url",
            "logo_mark_dark_url",
            "logo_wide_url",
            "logo_wide_dark_url",
        ]

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get("request")
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def _variants(self, obj):
        if not hasattr(obj, "_logo_variants"):
            obj._logo_variants = logo_variants(obj, self.context.get("request"))
        return obj._logo_variants

    def get_logo_dark_url(self, obj):
        return self._variants(obj)["logo_dark_url"]

    def get_logo_mark_url(self, obj):
        return self._variants(obj)["logo_mark_url"]

    def get_logo_mark_dark_url(self, obj):
        return self._variants(obj)["logo_mark_dark_url"]

    def get_logo_wide_url(self, obj):
        return self._variants(obj)["logo_wide_url"]

    def get_logo_wide_dark_url(self, obj):
        return self._variants(obj)["logo_wide_dark_url"]
