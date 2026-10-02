from rest_framework import serializers
from rest_framework.fields import empty

from catalog.logo import logo_variants, warm_logo_variants
from catalog.media_urls import browser_media_url
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
            "city",
            "country",
            "vrn_number",
            "address",
            "tagline",
            "welcome_title",
            "welcome_text",
            "logo",
            "logo_url",
            "logo_dark_url",
            "logo_mark_url",
            "logo_mark_dark_url",
            "logo_wide_url",
            "logo_wide_dark_url",
            "primary_color",
            "secondary_color",
            "tin_number",
            "bank_account_name",
            "bank_account_number",
            "bank_iban",
            "bank_swift",
            "bank_name",
            "bank_branch",
            "bank_branch_code",
            "bank_correspondent",
            "bank_correspondent_swift",
            "invoice_terms",
            "invoice_footer",
        ]
        extra_kwargs = {
            "logo": {"write_only": True, "required": False, "allow_null": True},
        }
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
        return browser_media_url(obj.logo.url)

    def update(self, instance, validated_data):
        new_logo = validated_data.pop("logo", empty)
        instance = super().update(instance, validated_data)
        if new_logo is not empty:
            instance.logo = new_logo
            instance.save(update_fields=["logo"])
            warm_logo_variants(instance)
        return instance

    def _variants(self, obj):
        if not hasattr(obj, "_logo_variants"):
            obj._logo_variants = logo_variants(obj)
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
