from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import Permission, Role

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "role",
            "role_name",
            "is_superadmin",
            "is_active",
            "permissions",
            "created_at",
        ]
        read_only_fields = ["is_superadmin", "created_at", "permissions", "role_name"]

    def get_permissions(self, obj):
        return obj.permission_codes()


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "is_active", "password"]

    def validate_email(self, value):
        return User.objects.normalize_email(value)

    def create(self, validated):
        password = validated.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Set a password for the new user."})
        return User.objects.create_user(password=password, **validated)

    def update(self, instance, validated):
        password = validated.pop("password", None)
        for key, value in validated.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()
    permission_codes = serializers.SlugRelatedField(
        source="permissions",
        many=True,
        slug_field="code",
        queryset=Permission.objects.all(),
        required=False,
    )

    class Meta:
        model = Role
        fields = ["id", "name", "description", "permission_codes", "user_count", "created_at"]

    def get_user_count(self, role):
        return getattr(role, "user_count", None) if hasattr(role, "user_count") else role.users.count()


class PermissionSerializer(serializers.ModelSerializer):
    resource = serializers.SerializerMethodField()
    action = serializers.SerializerMethodField()
    resource_label = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "code", "label", "module", "resource", "action", "resource_label"]

    def _info(self, obj):
        from accounts.permissions_catalog import describe

        return describe(obj.code)

    def get_resource(self, obj):
        return self._info(obj)["resource"]

    def get_action(self, obj):
        return self._info(obj)["action"]

    def get_resource_label(self, obj):
        return self._info(obj)["resource_label"]


class EmailTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        data["user"] = UserSerializer(self.user).data
        return data


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("The current password is wrong.")
        return value
