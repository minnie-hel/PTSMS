from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import Permission, Role
from accounts.permissions import HasCode, RolePermission
from accounts.serializers import (
    EmailTokenSerializer,
    PasswordChangeSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserSerializer,
    UserWriteSerializer,
)
from common.mixins import AuditMixin, ProtectedDestroyMixin

User = get_user_model()


class LoginView(TokenObtainPairView):
    permission_classes = []
    authentication_classes = []
    serializer_class = EmailTokenSerializer


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class StaffView(APIView):
    def get(self, request):
        people = User.objects.filter(is_active=True).order_by("full_name")
        return Response([{"id": person.id, "full_name": person.full_name} for person in people])


class PasswordView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        validate_password(serializer.validated_data["new_password"], request.user)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class UserViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = User.objects.select_related("role").order_by("full_name")
    permission_classes = [HasCode]
    read_permission = "users.view"
    write_permission = "users.manage"
    search_fields = ["full_name", "email", "phone"]
    filterset_fields = ["is_active", "role"]
    audit_label = "user"
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superadmin:
            return Response({"detail": "The super admin account cannot be deleted."}, status=400)
        if user.pk == request.user.pk:
            return Response({"detail": "You cannot delete your own account."}, status=400)
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.is_superadmin and serializer.validated_data.get("is_active") is False:
            if not User.objects.filter(is_superadmin=True, is_active=True).exclude(pk=instance.pk).exists():
                from rest_framework.exceptions import ValidationError

                raise ValidationError("Keep at least one active super admin.")
        return super().perform_update(serializer)


class RoleViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = Role.objects.prefetch_related("permissions").annotate(user_count=Count("users")).order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [RolePermission]
    pagination_class = None
    search_fields = ["name", "description"]

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.users.exists():
            return Response(
                {"detail": "Users are still assigned to this role. Move them to another role first."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)


class PermissionCatalogView(APIView):
    """Modules, their screens, and the actions each screen offers (for the role editor)."""

    def get(self, request):
        from accounts.permissions_catalog import ACTION_LABELS, catalog_tree

        user = request.user
        if not user.has_code("roles.view"):
            return Response({"detail": "You do not have permission to do that."}, status=403)
        return Response({"modules": catalog_tree(), "actions": ACTION_LABELS})


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [HasCode]
    read_permission = "roles.view"
    pagination_class = None
