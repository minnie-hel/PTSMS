from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("An email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_superadmin", True)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        return self.create_user(email, password, **extra)


class Permission(models.Model):
    code = models.CharField(max_length=80, unique=True)
    label = models.CharField(max_length=160)
    module = models.CharField(max_length=40)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self):
        return self.label


class Role(models.Model):
    name = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="roles")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=40, blank=True)
    role = models.ForeignKey(
        Role, null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    is_superadmin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    def __str__(self):
        return self.full_name or self.email

    def permission_codes(self):
        from accounts.permissions_catalog import expand_codes

        if self.is_superadmin:
            return list(Permission.objects.values_list("code", flat=True))
        if not self.role_id:
            return []
        stored = self.role.permissions.values_list("code", flat=True)
        return sorted(expand_codes(stored))

    def has_code(self, code):
        if self.is_superadmin:
            return True
        if not self.role_id:
            return False
        return code in self.permission_codes()
