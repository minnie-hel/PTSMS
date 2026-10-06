from rest_framework import serializers
from rest_framework.fields import empty

from catalog.logo import logo_variants, warm_logo_variants
from catalog.media_urls import browser_media_url
from catalog.models import CompanyBankAccount, CompanyProfile


class CompanyBankSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    currency_code = serializers.CharField(source="currency.code", read_only=True)

    class Meta:
        model = CompanyBankAccount
        fields = [
            "id",
            "currency",
            "currency_code",
            "account_name",
            "account_number",
            "iban",
            "swift",
            "bank_name",
            "branch",
            "branch_code",
            "correspondent",
            "correspondent_swift",
        ]
        extra_kwargs = {
            "currency": {"required": False, "allow_null": True},
        }


class CompanySerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    logo_dark_url = serializers.SerializerMethodField()
    logo_mark_url = serializers.SerializerMethodField()
    logo_mark_dark_url = serializers.SerializerMethodField()
    logo_wide_url = serializers.SerializerMethodField()
    logo_wide_dark_url = serializers.SerializerMethodField()
    banks = CompanyBankSerializer(many=True, required=False)

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
            "banks",
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
        banks = validated_data.pop("banks", empty)
        new_logo = validated_data.pop("logo", empty)
        instance = super().update(instance, validated_data)
        if new_logo is not empty:
            instance.logo = new_logo
            instance.save(update_fields=["logo"])
            warm_logo_variants(instance)
        if banks is not empty:
            self._sync_banks(instance, banks)
            self._copy_primary_bank(instance)
        return instance

    def _sync_banks(self, company, rows):
        keep = []
        for row in rows:
            bank_id = row.pop("id", None)
            if bank_id:
                bank = company.banks.get(pk=bank_id)
                for key, value in row.items():
                    setattr(bank, key, value)
                bank.save()
                keep.append(bank.id)
            else:
                keep.append(CompanyBankAccount.objects.create(company=company, **row).id)
        company.banks.exclude(id__in=keep or [0]).delete()

    def _copy_primary_bank(self, company):
        bank = company.banks.select_related("currency").first()
        if not bank:
            return
        company.bank_account_name = bank.account_name
        company.bank_account_number = bank.account_number
        company.bank_iban = bank.iban
        company.bank_swift = bank.swift
        company.bank_name = bank.bank_name
        company.bank_branch = bank.branch
        company.bank_branch_code = bank.branch_code
        company.bank_correspondent = bank.correspondent
        company.bank_correspondent_swift = bank.correspondent_swift
        company.save(
            update_fields=[
                "bank_account_name",
                "bank_account_number",
                "bank_iban",
                "bank_swift",
                "bank_name",
                "bank_branch",
                "bank_branch_code",
                "bank_correspondent",
                "bank_correspondent_swift",
            ]
        )

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
